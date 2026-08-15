import { Hono } from "hono";
import page from "./index.html";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.html(page));

export default app;
