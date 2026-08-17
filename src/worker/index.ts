import { Hono } from "hono";
import page from "./index.html";

type Bindings = Env & {
	COMMENTS: D1Database;
	COMMENT_SALT?: string;
	OWNER_IP?: string;
};

type Comment = {
	id: number;
	body: string;
	created_at: number;
	is_owner: number;
};

const app = new Hono<{ Bindings: Bindings }>();

const escapeHtml = (text: string) => text
	.replaceAll("&", "&amp;")
	.replaceAll("<", "&lt;")
	.replaceAll(">", "&gt;")
	.replaceAll('"', "&quot;")
	.replaceAll("'", "&#039;");

const commentsHtml = (comments: Comment[], isOwner: boolean, message?: string) => {
	const list = comments.length
		? comments.map((comment) => {
			const date = new Date(comment.created_at * 1000);
			const readableDate = date.toLocaleString("en", {
				dateStyle: "medium",
				timeStyle: "short",
				timeZone: "UTC",
			});
			const deleteButton = isOwner
				? `<form class="delete-comment" method="post" action="/comments/${comment.id}/delete">
					<button type="submit">delete</button>
				</form>`
				: "";

			return `<article class="comment">
				<strong>${comment.is_owner ? "owner" : "anonymous"}</strong><br>
				<time datetime="${date.toISOString()}">${readableDate} utc</time>
				<p>${escapeHtml(comment.body)}</p>
				${deleteButton}
			</article>`;
		}).join("\n")
		: "<p>its quiet here for now...</p>";

	return `<section class="comments" id="comments">
		<h2>guestbook :3</h2>
		<p class="note">comments are anonymous. be kind &lt;3</p>
		${message ? `<p class="comment-message">${message}</p>` : ""}
		<form class="comment-form" method="post" action="/comments">
			<label for="comment-body">your comment</label>
			<textarea id="comment-body" name="body" maxlength="1000" required></textarea>
			<label class="website-field" for="website">leave this empty</label>
			<input class="website-field" id="website" name="website" type="text" tabindex="-1" autocomplete="off">
			<button type="submit">leave a comment</button>
		</form>
		<div class="comment-list">
			${list}
		</div>
	</section>`;
};

const hashVisitor = async (visitor: string, salt: string) => {
	const input = new TextEncoder().encode(`${salt}:${visitor}`);
	const digest = await crypto.subtle.digest("SHA-256", input);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const isOwner = (visitor: string | undefined, requestUrl: string, ownerIp?: string) => {
	if (ownerIp && visitor === ownerIp) return true;

	const hostname = new URL(requestUrl).hostname;
	const localSite = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
	const localVisitor = !visitor || visitor === "127.0.0.1" || visitor === "::1";
	return localSite && localVisitor;
};

app.get("/", async (c) => {
	const messages: Record<string, string> = {
		posted: "thank :3",
		empty: "comments cant be empty (duh)",
		long: "too long ;p (1000 characters max)",
		fast: "slow down! you can post once every 5 minutes, up to 5 times a day",
		deleted: "comment gone :3",
		unavailable: "comments are fucked right now. try again later",
	};

	let comments: Comment[] = [];
	const status = c.req.query("comment");
	let message = status ? messages[status] : undefined;
	const owner = isOwner(c.req.header("cf-connecting-ip"), c.req.url, c.env.OWNER_IP);

	try {
		const result = await c.env.COMMENTS.prepare(
			"SELECT id, body, created_at, is_owner FROM comments ORDER BY created_at DESC LIMIT 100",
		).all<Comment>();
		comments = result.results;
	} catch {
		message = messages.unavailable;
	}

	c.header("Cache-Control", "no-store");
	return c.html(page.replace("<!-- comments -->", commentsHtml(comments, owner, message)));
});

app.post("/comments", async (c) => {
	const origin = c.req.header("origin");
	if (origin && new URL(origin).host !== new URL(c.req.url).host) return c.text("no", 403);

	const form = await c.req.parseBody();
	if (form.website) return c.redirect("/#comments", 303);

	const body = typeof form.body === "string" ? form.body.trim() : "";
	if (!body) return c.redirect("/?comment=empty#comments", 303);
	if (body.length > 1000) return c.redirect("/?comment=long#comments", 303);

	const visitorHeader = c.req.header("cf-connecting-ip");
	const visitor = visitorHeader || "local";
	const owner = isOwner(visitorHeader, c.req.url, c.env.OWNER_IP);

	try {
		if (owner) {
			await c.env.COMMENTS.prepare(
				"INSERT INTO comments (body, is_owner) VALUES (?1, 1)",
			).bind(body).run();
			return c.redirect("/?comment=posted#comments", 303);
		}

		const salt = c.env.COMMENT_SALT || c.env.PAW_API_KEY;
		if (!salt) return c.redirect("/?comment=unavailable#comments", 303);

		const visitorHash = await hashVisitor(visitor, salt);
		const result = await c.env.COMMENTS.prepare(`
			INSERT INTO comments (body, visitor_hash)
			SELECT ?1, ?2
			WHERE NOT EXISTS (
				SELECT 1 FROM comments
				WHERE visitor_hash = ?2 AND created_at > unixepoch() - 300
			)
			AND (
				SELECT count(*) FROM comments
				WHERE visitor_hash = ?2 AND created_at > unixepoch() - 86400
			) < 5
		`).bind(body, visitorHash).run();

		if (!result.meta.changes) return c.redirect("/?comment=fast#comments", 303);

		await c.env.COMMENTS.prepare(`
			UPDATE comments SET visitor_hash = NULL
			WHERE visitor_hash IS NOT NULL AND created_at <= unixepoch() - 86400
		`).run();
	} catch {
		return c.redirect("/?comment=unavailable#comments", 303);
	}

	return c.redirect("/?comment=posted#comments", 303);
});

app.post("/comments/:id/delete", async (c) => {
	const origin = c.req.header("origin");
	if (origin && new URL(origin).host !== new URL(c.req.url).host) return c.text("no", 403);

	const visitor = c.req.header("cf-connecting-ip");
	if (!isOwner(visitor, c.req.url, c.env.OWNER_IP)) return c.text("no", 403);

	const id = Number(c.req.param("id"));
	if (!Number.isSafeInteger(id) || id < 1) return c.text("nope", 400);

	await c.env.COMMENTS.prepare("DELETE FROM comments WHERE id = ?1").bind(id).run();
	return c.redirect("/?comment=deleted#comments", 303);
});

app.post("/api/status/:name", async (c) => {
	if (!c.env.PAW_API_KEY || c.req.header("x-api-key") !== c.env.PAW_API_KEY) return c.text("no", 401);
	const name = c.req.param("name");
	const body = await c.req.text();
	await c.env.KV.put(name, body);
	return c.text("ok");
});

app.get("/api/status/:name", async (c) => {
	const v = await c.env.KV.get(c.req.param("name"));
	if (!v) return c.text("nope", 404);
	return c.text(v);
});

app.delete("/api/status/:name", async (c) => {
	if (!c.env.PAW_API_KEY || c.req.header("x-api-key") !== c.env.PAW_API_KEY) return c.text("no", 401);
	await c.env.KV.delete(c.req.param("name"));
	return c.text("ok");
});

export default app;
