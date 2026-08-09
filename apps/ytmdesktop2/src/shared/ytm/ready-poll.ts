/** Build main-world async poll — one executeJavaScript roundtrip. */
export function buildYtmReadyPollScript(options: {
	timeoutMs: number;
	/** Require `window.isYTMLoaded()`. Default true. */
	requireLoaded?: boolean;
	/** Require playerApi.isReady() from DOM. Default true. */
	requirePlayer?: boolean;
	/** Poll interval ms. Default 50. */
	intervalMs?: number;
}): string {
	const timeoutMs = Math.max(100, Math.floor(options.timeoutMs));
	const intervalMs = Math.max(16, Math.floor(options.intervalMs ?? 50));
	const requireLoaded = options.requireLoaded !== false;
	const requirePlayer = options.requirePlayer !== false;

	return `(async () => {
  const deadline = Date.now() + ${timeoutMs};
  const needLoaded = ${requireLoaded ? "true" : "false"};
  const needPlayer = ${requirePlayer ? "true" : "false"};
  const interval = ${intervalMs};
  const selectors = ["body>ytmusic-app", "ytmusic-app-layout>ytmusic-player-bar"];

  const isPlayerReady = () => {
    try {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        const api = el && el.playerApi;
        if (!api) continue;
        const ready = typeof api.isReady === "function" ? api.isReady() : !!api.isReady;
        if (ready) return true;
      }
    } catch (e) {}
    return false;
  };

  const isLoaded = () => {
    try {
      return typeof window.isYTMLoaded === "function" && !!window.isYTMLoaded();
    } catch (e) {
      return false;
    }
  };

  while (Date.now() < deadline) {
    const loadedOk = !needLoaded || isLoaded();
    const playerOk = !needPlayer || isPlayerReady();
    if (loadedOk && playerOk) return true;
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
})()`;
}
