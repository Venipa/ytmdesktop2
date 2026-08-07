/** Custom scheme for app-window thumbnail cache (not used by youtubeView). */
export const APP_THUMB_SCHEME = "ytmd-thumb";
export const APP_THUMB_HOST = "i";

const CACHABLE_HOST = /(^|\.)(googleusercontent\.com|ggpht\.com|ytimg\.com)$/i;

/** Remote CDN thumbs safe to pull through main-process cache. */
export function isCachableThumbUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "https:" && CACHABLE_HOST.test(parsed.hostname);
	} catch {
		return false;
	}
}

export function isAppThumbUrl(url: string): boolean {
	try {
		return new URL(url).protocol === `${APP_THUMB_SCHEME}:`;
	} catch {
		return false;
	}
}

function toBase64Url(value: string): string {
	if (typeof Buffer !== "undefined") {
		return Buffer.from(value, "utf8").toString("base64url");
	}
	const bytes = new TextEncoder().encode(value);
	let binary = "";
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
	if (typeof Buffer !== "undefined") {
		return Buffer.from(value, "base64url").toString("utf8");
	}
	const padded = value.replace(/-/g, "+").replace(/_/g, "/");
	const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
	const binary = atob(padded + pad);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return new TextDecoder().decode(bytes);
}

/**
 * Map remote thumb → `ytmd-thumb://i/<base64url>` for tray/miniplayer/etc.
 * Path encoding avoids `=` / `&` breaking query parsing (CDN size suffixes).
 */
export function toAppThumbUrl(url: string | null | undefined): string | null {
	if (!url) return null;
	if (isAppThumbUrl(url)) return url;
	if (!isCachableThumbUrl(url)) return url;
	return `${APP_THUMB_SCHEME}://${APP_THUMB_HOST}/${toBase64Url(url)}`;
}

/** Extract remote URL from a `ytmd-thumb` request URL. */
export function fromAppThumbRequest(requestUrl: string): string | null {
	try {
		const parsed = new URL(requestUrl);
		if (parsed.protocol !== `${APP_THUMB_SCHEME}:`) return null;

		// New: path payload `ytmd-thumb://i/<base64url>`
		const pathPayload = parsed.pathname.replace(/^\/+/, "");
		if (pathPayload) {
			const remote = fromBase64Url(decodeURIComponent(pathPayload));
			if (isCachableThumbUrl(remote)) return remote;
		}

		// Legacy: `?u=<urlencoded>` (may truncate on `=` in CDN urls)
		const legacy = parsed.searchParams.get("u");
		if (legacy && isCachableThumbUrl(legacy)) return legacy;

		return null;
	} catch {
		return null;
	}
}
