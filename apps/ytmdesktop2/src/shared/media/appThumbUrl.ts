/** Custom scheme for app-window thumbnail cache (not used by youtubeView). */
export const APP_THUMB_SCHEME = "ytmd-thumb";
export const APP_THUMB_HOST = "i";

const CACHABLE_HOST =
	/(^|\.)(googleusercontent\.com|ggpht\.com|ytimg\.com)$/i;

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

/**
 * Map remote thumb → `ytmd-thumb://i/?u=...` for tray/miniplayer/etc.
 * Pass-through if already cached scheme or not a CDN thumb.
 */
export function toAppThumbUrl(url: string | null | undefined): string | null {
	if (!url) return null;
	if (isAppThumbUrl(url)) return url;
	if (!isCachableThumbUrl(url)) return url;
	const target = new URL(`${APP_THUMB_SCHEME}://${APP_THUMB_HOST}/`);
	target.searchParams.set("u", url);
	return target.toString();
}

/** Extract remote URL from a `ytmd-thumb` request URL. */
export function fromAppThumbRequest(requestUrl: string): string | null {
	try {
		const parsed = new URL(requestUrl);
		if (parsed.protocol !== `${APP_THUMB_SCHEME}:`) return null;
		const remote = parsed.searchParams.get("u");
		if (!remote || !isCachableThumbUrl(remote)) return null;
		return remote;
	} catch {
		return null;
	}
}
