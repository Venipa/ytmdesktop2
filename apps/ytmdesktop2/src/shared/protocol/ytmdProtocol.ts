/** Custom app protocol scheme (setAsDefaultProtocolClient + electron-builder). */
export const YTMD_PROTOCOL = "ytmd";

/** YouTube video ids are 11 chars from the URL-safe alphabet. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export interface YtmdWatchAction {
	type: "watch";
	videoId: string;
}

export type YtmdProtocolAction = YtmdWatchAction;

export const parseYtmdWatchUrlById = (id: string): string => `${YTMD_PROTOCOL}://watch/${id}`;

export function isYtmdProtocolUrl(url: string): boolean {
	return /^ytmd:\/\//i.test(url.trim());
}

/**
 * Parse `ytmd://watch/<videoId>` (host or path form).
 * Returns null when URL is not a handled ytmd action.
 */
export function parseYtmdProtocolUrl(url: string): YtmdProtocolAction | null {
	const raw = url.trim();
	if (!isYtmdProtocolUrl(raw)) return null;

	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		return null;
	}

	if (parsed.protocol.toLowerCase() !== `${YTMD_PROTOCOL}:`) return null;

	const segments = [parsed.hostname, ...parsed.pathname.split("/")]
		.map((s) => s.trim())
		.filter(Boolean);
	if (segments[0]?.toLowerCase() !== "watch") return null;

	const videoId = segments[1];
	if (!videoId || !VIDEO_ID_RE.test(videoId)) return null;

	return { type: "watch", videoId };
}

/** First `ytmd://…` entry in argv (cold start / second-instance). */
export function findYtmdProtocolArg(argv: readonly string[]): string | null {
	return argv.find((arg): arg is string => typeof arg === "string" && isYtmdProtocolUrl(arg))?.trim() ?? null;
}
