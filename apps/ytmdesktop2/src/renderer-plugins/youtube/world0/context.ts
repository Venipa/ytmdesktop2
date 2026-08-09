import { createLogger } from "@shared/utils/console";
import type { RendererPluginContext } from "./types";

export function createRendererContext(name: string): RendererPluginContext {
	const ytmd = typeof window !== "undefined" ? (window as Window & { ytmd?: RendererPluginContext["ytmd"] }).ytmd ?? null : null;
	return {
		name,
		ytmd,
		log: createLogger("YTMD").child("plugin").child(name),
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
