import { Hono } from "hono";
import page from "./index.html";

const app = new Hono<{ Bindings: Env }>();

// static files (css, images, ...) live in /public and are served by wrangler,
// so the browser can just fetch them from their path - no route needed here.
// index.ts only handles pages it has to *build* (anything dynamic).
app.get("/", (c) => c.html(page));

export default app;
