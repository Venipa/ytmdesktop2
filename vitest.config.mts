import path from "node:path";
import { defineConfig } from "vitest/config";

const ytmdesktop2Src = path.resolve("apps/ytmdesktop2/src");

const isCi = process.env.CI === "true";

export default defineConfig({
	resolve: {
		alias: {
			"@main": path.join(ytmdesktop2Src, "main"),
			"@shared": path.join(ytmdesktop2Src, "shared"),
		},
	},
	test: {
		name: "ytmdesktop2-workspace",
		environment: "node",
		include: ["apps/**/src/**/*.{test,spec}.ts", "packages/**/src/**/*.{test,spec}.{ts,tsx}"],
		exclude: ["**/node_modules/**", "**/out/**", "**/dist/**", "**/.vite/**"],
		reporters: isCi ? ["default", "junit"] : ["default"],
		outputFile: isCi
			? {
					junit: "test-results/junit.xml",
				}
			: undefined,
	},
});
