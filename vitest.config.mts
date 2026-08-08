import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "ytmdesktop2-workspace",
		environment: "node",
		include: ["apps/**/src/**/*.{test,spec}.ts", "packages/**/src/**/*.{test,spec}.{ts,tsx}"],
		exclude: ["**/node_modules/**", "**/out/**", "**/dist/**", "**/.vite/**"],
	},
});
