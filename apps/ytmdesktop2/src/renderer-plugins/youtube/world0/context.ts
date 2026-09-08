import { createLogger } from "@shared/utils/console";
import { getYtmPlayerApiFromDom, isYtmPlayerApiReady } from "@shared/ytm";
import type { RendererPluginContext } from "./types";

export function createRendererContext(name: string): RendererPluginContext {
	const ytmd = typeof window !== "undefined" ? (window as Window & { ytmd?: RendererPluginContext["ytmd"] }).ytmd ?? null : null;
	return {
		name,
		ytmd,
		log: createLogger("YTMD").child("plugin").child(name),
	};
}

export function getPagePlayerApi(): import("ytm-client-api").PlayerApi | null {
	return (getYtmPlayerApiFromDom() as import("ytm-client-api").PlayerApi | null) ?? null;
}

export async function waitForPagePlayerApi(timeoutMs = 12_000): Promise<import("ytm-client-api").PlayerApi | null> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const api = getPagePlayerApi();
		if (isYtmPlayerApiReady(api)) return api;
		await new Promise((r) => setTimeout(r, 50));
	}
	return getPagePlayerApi();
}
