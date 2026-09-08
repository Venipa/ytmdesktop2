/** Keep this closure-free: ready-poll embeds it via Function.prototype.toString. */
export function isYtmPlayerApiReady(api: unknown): boolean {
	if (api == null || (typeof api !== "object" && typeof api !== "function")) return false;
	const player = api as { isReady?: (() => boolean) | boolean; playVideo?: unknown; getPlayerState?: unknown };
	try {
		if (typeof player.isReady === "function") return !!player.isReady();
		if (typeof player.isReady === "boolean") return player.isReady;
		return typeof player.playVideo === "function" && typeof player.getPlayerState === "function";
	} catch {
		return false;
	}
}

/** Prefer Polymer controller on `__YTMD_HOOK__` (YTM dropped `el.playerApi`). `#movie_player` is fallback. */
export function getYtmPlayerApiFromDom(): unknown {
	const ready = (api: unknown): boolean => {
		if (api == null || (typeof api !== "object" && typeof api !== "function")) return false;
		const player = api as { isReady?: (() => boolean) | boolean; playVideo?: unknown; getPlayerState?: unknown };
		try {
			if (typeof player.isReady === "function") return !!player.isReady();
			if (typeof player.isReady === "boolean") return player.isReady;
			return typeof player.playVideo === "function" && typeof player.getPlayerState === "function";
		} catch {
			return false;
		}
	};
	try {
		const hooked = (window as unknown as { __YTMD_HOOK__?: { ytmPlayerBar?: { playerApi?: unknown } } }).__YTMD_HOOK__
			?.ytmPlayerBar?.playerApi;
		if (ready(hooked)) return hooked;
	} catch {}
	if (typeof document === "undefined") return null;
	try {
		const el = document.querySelector("ytmusic-player-bar") as {
			playerApi?: unknown;
			resolvePlayerApi?: () => unknown;
			[key: string]: unknown;
		} | null;
		if (el) {
			if (ready(el.playerApi)) return el.playerApi;
			for (const key of Object.getOwnPropertyNames(el)) {
				if (!/playerController$/i.test(key)) continue;
				const ctrl = el[key] as { playerApi?: unknown } | undefined;
				if (ready(ctrl?.playerApi)) return ctrl.playerApi;
				if (ready(ctrl)) return ctrl;
			}
			if (typeof el.resolvePlayerApi === "function") {
				const resolved = el.resolvePlayerApi();
				if (ready(resolved)) return resolved;
			}
		}
	} catch {}
	const movie = document.querySelector("#movie_player");
	if (ready(movie)) return movie;
	return null;
}
