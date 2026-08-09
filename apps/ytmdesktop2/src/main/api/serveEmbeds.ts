import fs from "node:fs/promises";
import path from "node:path";
import type { Context } from "hono";
import { getMimeType } from "hono/utils/mime";

/**
 * Serve a file under `root` for request path under `urlPrefix`.
 * Returns null when path escapes root or file missing.
 */
export async function tryServeEmbedFile(
	c: Context,
	options: { root: string; urlPrefix: string },
): Promise<Response | null> {
	const { root, urlPrefix } = options;
	let reqPath = c.req.path;
	if (!reqPath.startsWith(urlPrefix)) return null;

	let rel = reqPath.slice(urlPrefix.length);
	if (rel.startsWith("/")) rel = rel.slice(1);
	if (!rel || rel.endsWith("/")) rel = path.posix.join(rel, "index.html");

	// Block path traversal
	if (rel.includes("..") || path.isAbsolute(rel)) return null;

	const filePath = path.resolve(root, ...rel.split("/"));
	const rootResolved = path.resolve(root);
	if (!filePath.startsWith(rootResolved + path.sep) && filePath !== rootResolved) {
		return null;
	}

	try {
		const data = await fs.readFile(filePath);
		const mime = getMimeType(filePath) || "application/octet-stream";
		return c.body(data, 200, {
			"Content-Type": mime,
			"Cache-Control": "no-cache",
		});
	} catch {
		return null;
	}
}
