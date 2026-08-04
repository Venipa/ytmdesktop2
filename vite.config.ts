import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";

/**
 * Stub for shadcn CLI (electron build uses electron.vite.config.ts).
 * Aliases mirror tsconfig.web.json only.
 */
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@shared": resolve(__dirname, "src/shared"),
			"@translations": resolve(__dirname, "src/translations"),
			"@main": resolve(__dirname, "src/main"),
			"@preload": resolve(__dirname, "src/preload"),
			"@renderer": resolve(__dirname, "src/renderer/src"),
			"@plugins": resolve(__dirname, "src/renderer-plugins"),
			"@": resolve(__dirname, "src/renderer/src"),
			"~": resolve(__dirname, "."),
		},
	},
});
