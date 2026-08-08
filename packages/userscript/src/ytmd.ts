const SCHEME = "ytmd";
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{2,128}$/;
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{20,24}$/;
const HANDLE_RE = /^[A-Za-z0-9._-]{1,50}$/;

function isMusicHost(host: string): boolean {
	const h = host.trim().toLowerCase();
	return h === "music.youtube.com" || h === "www.music.youtube.com";
}

/** youtube.com / www.youtube.com (not m.). */
function isYoutubeDesktopHost(host: string): boolean {
	const h = host.trim().toLowerCase();
	return h === "youtube.com" || h === "www.youtube.com";
}

function isMYoutubeHost(host: string): boolean {
	return host.trim().toLowerCase() === "m.youtube.com";
}

function isYoutuBeHost(host: string): boolean {
	const h = host.trim().toLowerCase();
	return h === "youtu.be" || h === "www.youtu.be";
}

/** Hosts that support the https→ytmd address-bar swap. */
export function isConvertibleHost(host: string): boolean {
	return (
		isMusicHost(host) ||
		isYoutubeDesktopHost(host) ||
		isMYoutubeHost(host) ||
		isYoutuBeHost(host)
	);
}

export type HostSite = "music" | "youtube" | "mYoutube" | "youtuBe";

/** Map hostname to settings site key (or null). */
export function hostSite(host: string): HostSite | null {
	if (isMusicHost(host)) return "music";
	if (isYoutubeDesktopHost(host)) return "youtube";
	if (isMYoutubeHost(host)) return "mYoutube";
	if (isYoutuBeHost(host)) return "youtuBe";
	return null;
}

export function hostSiteFromUrl(url: string): HostSite | null {
	try {
		return hostSite(new URL(url).hostname);
	} catch {
		return null;
	}
}

function decodeSegment(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function normalizeHandle(value: string): string | null {
	const handle = value.trim().replace(/^@+/, "");
	return HANDLE_RE.test(handle) ? handle : null;
}

function pathSegments(pathname: string): string[] {
	return pathname
		.split("/")
		.map((s) => decodeSegment(s.trim()))
		.filter(Boolean);
}

/** True when URL maps to watch / playlist / channel / handle content. */
export function isActionableUrl(url: string): boolean {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}
	if (!/^https?:$/i.test(parsed.protocol)) return false;
	if (!isConvertibleHost(parsed.hostname)) return false;

	if (isYoutuBeHost(parsed.hostname)) {
		const videoId = pathSegments(parsed.pathname)[0]?.trim();
		return Boolean(videoId && VIDEO_ID_RE.test(videoId));
	}

	const segments = pathSegments(parsed.pathname);
	const head = segments[0]?.toLowerCase();

	if (head === "watch") {
		const videoId = parsed.searchParams.get("v")?.trim() || segments[1]?.trim();
		return Boolean(videoId && VIDEO_ID_RE.test(videoId));
	}

	if (head === "shorts" || head === "embed") {
		const videoId = segments[1]?.trim();
		return Boolean(videoId && VIDEO_ID_RE.test(videoId));
	}

	if (head === "playlist") {
		const list = parsed.searchParams.get("list")?.trim() || segments[1]?.trim();
		return Boolean(list && PLAYLIST_ID_RE.test(list));
	}

	if (head === "channel") {
		const id = segments[1]?.trim();
		return Boolean(id && CHANNEL_ID_RE.test(id));
	}

	const at = segments[0]?.startsWith("@") ? segments[0] : null;
	if (at) return Boolean(normalizeHandle(at));

	return false;
}

/**
 * Scheme-swap convertible https URL to ytmd:// (or null).
 * Only returns a value for actionable watch/playlist/channel paths.
 */
export function toYtmd(url: string): string | null {
	const raw = url.trim();
	if (!isActionableUrl(raw)) return null;
	return raw.replace(/^https?:/i, `${SCHEME}:`);
}
