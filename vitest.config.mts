import { defineConfig } from "vitest/config";

const isCi = process.env.CI === "true";

export default defineConfig({
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
