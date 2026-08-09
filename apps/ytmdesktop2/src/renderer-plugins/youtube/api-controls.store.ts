import { YTMD_STORE_PAGE_HOOK_SOURCE } from "@preload/ytmd-agent";

type StoreHookDeps = {
	log: {
		debug: (...args: unknown[]) => void;
		warn: (...args: unknown[]) => void;
	};
	domUtils: {
		createAndRunScript: (script: string, key?: string) => Promise<unknown>;
		ensureDomLoaded: (fn: () => void) => void;
	};
};

/**
 * Capture YTM redux store in page world under isolation.
 * Preload cannot read Polymer `.store` expandos; poll via createAndRunScript.
 */
export function startYtmStoreHook({ log, domUtils }: StoreHookDeps): void {
	const tryPageHook = async (): Promise<boolean> => {
		try {
			const ok = await domUtils.createAndRunScript(YTMD_STORE_PAGE_HOOK_SOURCE, "ytm-store-page-hook");
			return ok === true;
		} catch (err) {
			log.debug("page __YTMD_HOOK__ sync failed", err);
			return false;
		}
	};

	domUtils.ensureDomLoaded(() => {
		void (async () => {
			if (await tryPageHook()) {
				log.debug("ytmStore hooked (page world)");
				return;
			}
			const started = Date.now();
			const timer = window.setInterval(() => {
				void tryPageHook().then((ok) => {
					if (ok) {
						window.clearInterval(timer);
						log.debug("ytmStore hooked (page world)");
						return;
					}
					if (Date.now() - started > 20_000) {
						window.clearInterval(timer);
						log.warn("ytmStore hook timed out - queue UI sync may be limited");
					}
				});
			}, 250);
		})();
	});
}
