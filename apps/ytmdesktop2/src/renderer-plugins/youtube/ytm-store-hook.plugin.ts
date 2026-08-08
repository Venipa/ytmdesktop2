import definePlugin from "@plugins/utils";

type YtmStore = {
	getState: () => unknown;
	dispatch: (action: unknown) => void;
	subscribe: (listener: () => void) => () => void;
};

function isYtmStore(value: unknown): value is YtmStore {
	if (!value || typeof value !== "object") return false;
	const store = value as Record<string, unknown>;
	return typeof store.getState === "function" && typeof store.dispatch === "function" && typeof store.subscribe === "function";
}

function readDomStore(): YtmStore | null {
	const selectors = ["ytmusic-app", "ytmusic-app-layout>ytmusic-player-bar", "ytmusic-player-bar"] as const;
	for (const selector of selectors) {
		const el = document.querySelector(selector) as { store?: unknown } | null;
		if (isYtmStore(el?.store)) return el.store;
	}
	return null;
}

function ensureYtmdHook(store: YtmStore): void {
	const existing = (window as unknown as { __YTMD_HOOK__?: { ytmStore?: YtmStore } }).__YTMD_HOOK__;
	if (existing?.ytmStore && isYtmStore(existing.ytmStore)) return;
	const hook = { ytmStore: store };
	Object.freeze(hook);
	(window as unknown as { __YTMD_HOOK__: { ytmStore: YtmStore } }).__YTMD_HOOK__ = hook;
}

/**
 * Capture YTM redux store onto `window.__YTMD_HOOK__` (upstream companion pattern)
 * so queueAdd / other cmds can dispatch ADD_ITEMS reliably.
 */
export default definePlugin(
	"ytm-store-hook",
	{
		enabled: true,
		displayName: "YTM Store Hook",
		service: "api",
	},
	{
		afterInit({ log, domUtils }) {
			const tryHook = () => {
				const store = readDomStore();
				if (!store) return false;
				ensureYtmdHook(store);
				log.debug("ytmStore hooked");
				return true;
			};

			if (tryHook()) return;

			domUtils.ensureDomLoaded(() => {
				if (tryHook()) return;
				const started = Date.now();
				const timer = window.setInterval(() => {
					if (tryHook() || Date.now() - started > 20_000) {
						window.clearInterval(timer);
						if (!(window as unknown as { __YTMD_HOOK__?: unknown }).__YTMD_HOOK__) {
							log.warn("ytmStore hook timed out — queue UI sync may be limited");
						}
					}
				}, 250);
			});
		},
	},
);
