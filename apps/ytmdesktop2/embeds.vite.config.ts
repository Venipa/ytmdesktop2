import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const embedsSrc = path.resolve(appRoot, "src/shared/embeds");

/** Builds OBS embed SPAs into `resources/embeds` (served by local API). */
export default defineConfig({
	plugins: [react()],
	base: "/embed/now-playing/",
	root: path.resolve(embedsSrc, "now-playing"),
	build: {
		outDir: path.resolve(appRoot, "resources/embeds/now-playing"),
		emptyOutDir: true,
		sourcemap: false,
	},
});
