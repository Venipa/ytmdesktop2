import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

export default defineConfig({
	plugins: [
		monkey({
			entry: "src/main.ts",
			userscript: {
				name: "YTMDesktop Open Links",
				namespace: "https://youtube-music.app",
				description:
					"Open YouTube Music / YouTube / youtu.be pages in YTMDesktop2 via ytmd:// on load/navigate. Per-host Tampermonkey menu toggles (music.youtube on by default).",
				author: "Venipa",
				homepage: "https://youtube-music.app",
				homepageURL: "https://github.com/Venipa/ytmdesktop2",
				supportURL: "https://github.com/Venipa/ytmdesktop2/issues",
				match: [
					"*://music.youtube.com/*",
					"*://www.music.youtube.com/*",
					"*://youtube.com/*",
					"*://www.youtube.com/*",
					"*://m.youtube.com/*",
					"*://youtu.be/*",
					"*://www.youtu.be/*",
				],
				"run-at": "document-start",
				license: "MIT",
			},
			build: {
				fileName: "ytmdesktop-userscript.user.js",
			},
		}),
	],
});
