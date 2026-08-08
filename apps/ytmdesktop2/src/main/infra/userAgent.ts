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

/**
 * Firefox UA used pre-v1.0 for Google sign-in (`brickGoogleUA`).
 * Google's embedded-Chromium / Electron checks reject Chrome-like UAs;
 * this Firefox string was the working login workaround.
 */
export function getGoogleLoginUserAgent(): string {
	switch (process.platform) {
		case "darwin":
			return "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:139.0) Gecko/20100101 Firefox/139.0";
		case "linux":
			return "Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0";
		case "win32":
		default:
			// Classic brickGoogleUA from v0.11 / early 1.x era
			return "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:92.0) Gecko/20100101 Firefox/92.0";
	}
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
