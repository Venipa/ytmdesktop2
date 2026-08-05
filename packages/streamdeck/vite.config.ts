import { exec } from "node:child_process";
import path from "node:path";
import url from "node:url";
import { defineConfig, type Plugin } from "vite";

const sdPlugin = "com.venipa.ytmdesktop2.sdPlugin";
const isWatching = process.argv.includes("--watch");

function watchExternalsPlugin(): Plugin {
	return {
		name: "watch-externals",
		buildStart() {
			this.addWatchFile(path.resolve(sdPlugin, "manifest.json"));
		},
	};
}

function emitModulePackageFilePlugin(): Plugin {
	return {
		name: "emit-module-package-file",
		generateBundle() {
			this.emitFile({
				type: "asset",
				fileName: "package.json",
				source: '{ "type": "module" }',
			});
		},
	};
}

function restartStreamDeckPlugin(): Plugin {
	return {
		name: "restart-streamdeck",
		closeBundle() {
			if (!isWatching) return;
			exec("streamdeck restart com.venipa.ytmdesktop2", (err) => {
				if (err) console.warn(`[restart-streamdeck] ${err.message}`);
			});
		},
	};
}

export default defineConfig({
	plugins: [watchExternalsPlugin(), emitModulePackageFilePlugin(), restartStreamDeckPlugin()],
	resolve: {
		conditions: ["node"],
		mainFields: ["module", "jsnext:main", "jsnext", "main"],
	},
	build: {
		ssr: true,
		target: "node20",
		outDir: `${sdPlugin}/bin`,
		emptyOutDir: true,
		sourcemap: isWatching,
		minify: isWatching ? false : "esbuild",
		lib: {
			entry: path.resolve("src/plugin.ts"),
			formats: ["es"],
			fileName: () => "plugin.js",
		},
		rollupOptions: {
			output: {
				entryFileNames: "plugin.js",
				sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
					return url.pathToFileURL(path.resolve(path.dirname(sourcemapPath), relativeSourcePath)).href;
				},
			},
		},
	},
	ssr: {
		noExternal: true,
	},
});
