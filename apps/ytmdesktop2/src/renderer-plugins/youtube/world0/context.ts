import type { RendererPluginContext } from "./types";

function consoleLog(name: string) {
	const prefix = `[YTMD:plugin:${name}]`;
	return {
		debug: (...args: unknown[]) => console.debug(prefix, ...args),
		info: (...args: unknown[]) => console.info(prefix, ...args),
		warn: (...args: unknown[]) => console.warn(prefix, ...args),
		error: (...args: unknown[]) => console.error(prefix, ...args),
	};
}

export function createRendererContext(name: string): RendererPluginContext {
	const ytmd = typeof window !== "undefined" ? (window as Window & { ytmd?: RendererPluginContext["ytmd"] }).ytmd ?? null : null;
	return {
		name,
		ytmd,
		log: consoleLog(name),
	};
}

const PLAYER_SELECTORS = ["body>ytmusic-app", "ytmusic-app-layout>ytmusic-player-bar"] as const;

export function getPagePlayerApi(): import("ytm-client-api").PlayerApi | null {
	for (const sel of PLAYER_SELECTORS) {
		const el = document.querySelector(sel) as { playerApi?: import("ytm-client-api").PlayerApi } | null;
		if (el?.playerApi) return el.playerApi;
	}
	return null;
}

function isPlayerReady(api: { isReady?: (() => boolean) | boolean } | null): boolean {
	if (!api) return false;
	try {
		return typeof api.isReady === "function" ? !!api.isReady() : !!api.isReady;
	} catch {
		return false;
	}
}

export async function waitForPagePlayerApi(timeoutMs = 12_000): Promise<import("ytm-client-api").PlayerApi | null> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const api = getPagePlayerApi();
		if (isPlayerReady(api)) return api;
		await new Promise((r) => setTimeout(r, 50));
	}
	return getPagePlayerApi();
}
