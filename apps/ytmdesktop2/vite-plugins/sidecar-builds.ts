import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react-swc";
import { build as viteBuild, type Plugin } from "vite";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type SidecarKind = "world0" | "embeds";

let world0Queue: Promise<void> = Promise.resolve();
let embedsQueue: Promise<void> = Promise.resolve();
let world0Ready = false;
let embedsReady = false;

function enqueue(kind: SidecarKind, task: () => Promise<void>): Promise<void> {
	if (kind === "world0") {
		world0Queue = world0Queue.then(task, task);
		return world0Queue;
	}
	embedsQueue = embedsQueue.then(task, task);
	return embedsQueue;
}

async function buildWorld0(minify: boolean): Promise<void> {
	await viteBuild({
		configFile: false,
		logLevel: "warn",
		root: appRoot,
		resolve: {
			alias: {
				"@shared": path.resolve(appRoot, "src/shared"),
				"@plugins": path.resolve(appRoot, "src/renderer-plugins"),
				"@preload": path.resolve(appRoot, "src/preload"),
			},
		},
		plugins: [
			{
				name: "ytmd-world0-no-electron",
				enforce: "pre",
				resolveId(id) {
					if (id === "electron" || id.startsWith("electron/")) {
						throw new Error(
							`world0 host must not import "${id}" (page world has no Node/Electron). Keep electron imports in preload-only modules.`,
						);
					}
				},
			},
		],
		build: {
			lib: {
				entry: path.resolve(appRoot, "src/renderer-plugins/youtube/world0/host.ts"),
				name: "YtmdWorld0Host",
				formats: ["iife"],
				fileName: () => "ytmd-world0-host.js",
			},
			outDir: path.resolve(appRoot, "src/preload/generated"),
			emptyOutDir: false,
			sourcemap: false,
			minify,
			rollupOptions: {
				external: ["electron"],
				output: {
					inlineDynamicImports: true,
				},
			},
		},
	});
}

async function buildEmbeds(): Promise<void> {
	const embedsSrc = path.resolve(appRoot, "src/shared/embeds");
	await viteBuild({
		configFile: false,
		logLevel: "warn",
		plugins: [react()],
		base: "/embed/now-playing/",
		root: path.resolve(embedsSrc, "now-playing"),
		build: {
			outDir: path.resolve(appRoot, "resources/embeds/now-playing"),
			emptyOutDir: true,
			sourcemap: false,
		},
	});
}

function ensureWorld0(force = false): Promise<void> {
	const minify = process.env.NODE_ENV === "production";
	return enqueue("world0", async () => {
		if (world0Ready && !force) return;
		await buildWorld0(minify);
		world0Ready = true;
		console.log("[sidecar] world0 host built");
	});
}

function ensureEmbeds(force = false): Promise<void> {
	return enqueue("embeds", async () => {
		if (embedsReady && !force) return;
		await buildEmbeds();
		embedsReady = true;
		console.log("[sidecar] embeds built");
	});
}

function isWorld0Path(file: string): boolean {
	const n = file.replace(/\\/g, "/");
	if (n.includes("/preload/generated/")) return false;
	return n.includes("/renderer-plugins/youtube/") || n.includes("/shared/protocol/") || n.includes("/shared/ytm/");
}

function isEmbedsPath(file: string): boolean {
	const n = file.replace(/\\/g, "/");
	return n.includes("/shared/embeds/");
}

/** Preload: build world0 IIFE before `?raw` import resolves. */
export function ytmdWorld0BuildPlugin(): Plugin {
	return {
		name: "ytmd-world0-build",
		enforce: "pre",
		async buildStart() {
			await ensureWorld0(false);
		},
	};
}

/**
 * Renderer: build embeds (+ world0) and watch sources in `electron-vite dev`.
 * World0 file changes rewrite generated host -> preload watcher picks up `?raw`.
 */
export function ytmdSidecarWatchPlugin(): Plugin {
	let watchWired = false;

	return {
		name: "ytmd-sidecar-watch",
		enforce: "pre",
		async buildStart() {
			await Promise.all([ensureWorld0(false), ensureEmbeds(false)]);
		},
		configureServer(server) {
			if (watchWired) return;
			watchWired = true;
			void Promise.all([ensureWorld0(false), ensureEmbeds(false)]);

			for (const root of [
				path.resolve(appRoot, "src/renderer-plugins/youtube"),
				path.resolve(appRoot, "src/shared/embeds"),
				path.resolve(appRoot, "src/shared/protocol"),
				path.resolve(appRoot, "src/shared/ytm"),
			]) {
				server.watcher.add(root);
			}

			server.watcher.on("change", (file) => {
				if (isWorld0Path(file)) void ensureWorld0(true);
				if (isEmbedsPath(file)) void ensureEmbeds(true);
			});
		},
	};
}
