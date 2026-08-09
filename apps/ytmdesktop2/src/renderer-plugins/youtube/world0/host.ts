import { createRendererContext, waitForPagePlayerApi } from "./context";
import type { RendererPluginRegistration } from "./types";

declare global {
	interface Window {
		__YTMD_WORLD0_HOST__?: boolean;
		/** True after all renderer `start` hooks finished (bridges listening). */
		__YTMD_WORLD0_STARTED__?: boolean;
	}
}

function loadRendererPlugins(): RendererPluginRegistration[] {
	const modules = import.meta.glob("../*.renderer.ts", { eager: true }) as Record<
		string,
		{ default?: RendererPluginRegistration }
	>;
	return Object.values(modules)
		.map((mod) => mod.default)
		.filter((p): p is RendererPluginRegistration => !!p?.id);
}

async function boot(): Promise<void> {
	if (window.__YTMD_WORLD0_HOST__) return;
	window.__YTMD_WORLD0_HOST__ = true;

	const rendererPlugins = loadRendererPlugins();
	const destroyFns: Array<() => void> = [];
	const active = rendererPlugins.filter((p) => p.enabled !== false);

	// Parallel start so page bridges (`listen`) attach before preload afterInit/cmds race.
	await Promise.all(
		active.map(async (plugin) => {
			const ctx = createRendererContext(plugin.id);
			try {
				const maybeDestroy = await plugin.start?.(ctx);
				if (typeof maybeDestroy === "function") destroyFns.push(maybeDestroy);
			} catch (err) {
				ctx.log.error("start failed", err);
			}
		}),
	);
	window.__YTMD_WORLD0_STARTED__ = true;
	window.dispatchEvent(new Event("ytmd-world0-started"));

	const world0 = createRendererContext("world0");
	const ytmd = world0.ytmd;
	const offConfig =
		ytmd?.on("settingsProvider.change", (key, value) => {
			for (const plugin of active) {
				if (!plugin.onConfigChange) continue;
				const ctx = createRendererContext(plugin.id);
				void Promise.resolve(plugin.onConfigChange(String(key), value, ctx)).catch((err) => {
					ctx.log.error("onConfigChange failed", err);
				});
			}
		}) ?? (() => undefined);

	const playerApi = await waitForPagePlayerApi();
	if (playerApi) {
		for (const plugin of active) {
			const ctx = createRendererContext(plugin.id);
			try {
				await plugin.onPlayerApiReady?.(playerApi, ctx);
			} catch (err) {
				ctx.log.error("onPlayerApiReady failed", err);
			}
		}
	} else {
		world0.log.warn("playerApi not ready, skipping onPlayerApiReady hooks");
	}

	window.addEventListener(
		"beforeunload",
		() => {
			offConfig();
			for (const fn of destroyFns) {
				try {
					fn();
				} catch {
					/* ignore */
				}
			}
		},
		{ once: true },
	);
}

void boot();
