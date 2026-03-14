import vue from "@vitejs/plugin-vue";
import { defineConfig } from "electron-vite";
import { basename, resolve } from "path";
import { UserConfigExport } from "vite";
import svgLoader from "vite-svg-loader";

const glob = (await import("fast-glob")).default;
const resolveOptions: UserConfigExport = {
	resolve: {
		alias: {
			"@renderer": resolve("src/renderer/src"),
			"@main": resolve("src/main"),
			"@preload": resolve("src/preload"),
			"@shared": resolve("src/shared"),
			"@translations": resolve("src/translations"),
			"@plugins": resolve("src/renderer-plugins"),
			"@": resolve("src"),
			"~": resolve("."),
			"discord-rpc": resolve("src/main/lib/discord-rpc/discord-rpc.ts"),
		},
	},
};
const externalizedEsmDeps = ["lodash-es", "@faker-js/faker", "@trpc-limiter/memory", "got", "encryption.js"];
const youtubeClientPlugins = glob.globSync("./src/renderer-plugins/youtube/*.plugin.ts").map((file) => {
	const name = basename(file, ".ts");
	return [name, file];
});
export default defineConfig({
	main: {
		...resolveOptions,
		build: {
			externalizeDeps: { exclude: [...externalizedEsmDeps] },
			rollupOptions: {
				input: {
					index: resolve(__dirname, "src/main/main.ts"),
				},
				output: {
					manualChunks: (id: string): any => {
						if (externalizedEsmDeps.find((d) => d === id)) return id;
					},
				},
			},
		},
	},
	preload: {
		...resolveOptions,
		build: {
			externalizeDeps: { exclude: [...externalizedEsmDeps] },
			rollupOptions: {
				input: {
					youtube: resolve(__dirname, "src/preload/youtube.ts"),
					api: resolve(__dirname, "src/preload/api.ts"),
					login: resolve(__dirname, "src/preload/login.ts"),
					...Object.fromEntries(youtubeClientPlugins.map(([key, value]) => [`plugins/youtube/${key}`, value])),
				},
			},
		},
	},
	renderer: {
		...resolveOptions,
		plugins: [vue(), svgLoader()],
	},
});
