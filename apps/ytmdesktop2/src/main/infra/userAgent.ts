import { app } from "electron";

/**
 * Build a Chrome-like User-Agent from Electron's bundled Chromium version.
 * Strips Electron/app tokens so YTM sees a normal Chrome client while keeping
 * the Chrome major/full version aligned with the real Blink build.
 */
export function buildChromeUserAgent(chromeVersion: string = process.versions.chrome): string {
	const platformFragment = getPlatformUaFragment();
	return `Mozilla/5.0 (${platformFragment}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
}

/**
 * Transform an existing Electron UA into a Chrome UA, preserving platform bits
 * when possible and forcing Chrome/ to match process.versions.chrome.
 */
export function toChromeUserAgent(fromUserAgent: string, chromeVersion: string = process.versions.chrome): string {
	const appName = app.getName();
	const escapedAppName = appName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

	let ua = fromUserAgent
		.replace(/\sElectron\/\S+/gi, "")
		.replace(new RegExp(`\\s${escapedAppName}/\\S+`, "gi"), "")
		.replace(/\sChrome\/[\d.]+/i, ` Chrome/${chromeVersion}`)
		.replace(/\s{2,}/g, " ")
		.trim();

	if (!/Chrome\/[\d.]+/i.test(ua) || !/AppleWebKit\/537\.36/i.test(ua)) {
		return buildChromeUserAgent(chromeVersion);
	}

	return ua;
}

function getPlatformUaFragment(): string {
	switch (process.platform) {
		case "darwin":
			return "Macintosh; Intel Mac OS X 10_15_7";
		case "linux":
			return "X11; Linux x86_64";
		case "win32":
		default:
			return "Windows NT 10.0; Win64; x64";
	}
}
