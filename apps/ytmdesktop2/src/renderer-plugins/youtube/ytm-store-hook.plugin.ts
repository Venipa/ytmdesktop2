import definePlugin from "@plugins/utils";
import { cacheYtmStore, isYtmStore, resolveYtmStore } from "./ytm-store";

/**
 * Capture YTM redux store onto `window.__YTMD_HOOK__` (companion pattern)
 * so queue cmds can dispatch ADD_ITEMS reliably.
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
				const store = resolveYtmStore();
				if (!store || !isYtmStore(store)) return false;
				cacheYtmStore(store);
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
						if (!resolveYtmStore()) {
							log.warn("ytmStore hook timed out — queue UI sync may be limited");
						}
					}
				}, 250);
			});
		},
	},
);
