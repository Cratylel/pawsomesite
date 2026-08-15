// tells typescript that `import x from "./foo.html"` is just a string,
// so the .html import type-checks (wrangler bundles it at deploy time)
declare module "*.html" {
	const content: string;
	export default content;
}
