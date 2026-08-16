import { Hono } from "hono";
import page from "./index.html";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.html(page));

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
