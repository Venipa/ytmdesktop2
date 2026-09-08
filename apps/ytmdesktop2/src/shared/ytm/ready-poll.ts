import { getYtmPlayerApiFromDom } from "./player-api-dom";

/** Build main-world async poll — one executeJavaScript roundtrip. */
export function buildYtmReadyPollScript(options: {
	timeoutMs: number;
	/** Require `window.isYTMLoaded()`. Default true. */
	requireLoaded?: boolean;
	/** Require playerApi from DOM. Default true. */
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
  const getYtmPlayerApiFromDom = ${getYtmPlayerApiFromDom.toString()};

  const isLoaded = () => {
    try {
      return typeof window.isYTMLoaded === "function" && !!window.isYTMLoaded();
    } catch (e) {
      return false;
    }
  };

  while (Date.now() < deadline) {
    const loadedOk = !needLoaded || isLoaded();
    const playerOk = !needPlayer || !!getYtmPlayerApiFromDom();
    if (loadedOk && playerOk) return true;
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
})()`;
}
