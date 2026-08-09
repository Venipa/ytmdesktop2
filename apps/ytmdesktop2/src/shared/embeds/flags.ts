export type EmbedLayout = "default" | "compact" | "text" | "badge" | "fullscreen" | "stack" | "ticker";

export interface EmbedFlags {
	readonly layout: EmbedLayout;
	readonly art: boolean;
	readonly title: boolean;
	readonly artist: boolean;
	readonly progress: boolean;
	readonly transparent: boolean;
	readonly scale: number;
}

export interface EmbedUrlOptions extends EmbedFlags {
	/** Paired API token when authRequired — not a visual flag. */
	readonly token?: string | null;
}

const DEFAULT_FLAGS: EmbedFlags = {
	layout: "default",
	art: true,
	title: true,
	artist: true,
	progress: true,
	transparent: true,
	scale: 1,
};

const LAYOUTS = new Set<EmbedLayout>(["default", "compact", "text", "badge", "fullscreen", "stack", "ticker"]);

function parseBool(raw: string | null, fallback: boolean): boolean {
	if (raw == null || raw === "") return fallback;
	const v = raw.trim().toLowerCase();
	if (v === "0" || v === "false" || v === "off" || v === "no") return false;
	if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
	return fallback;
}

function parseScale(raw: string | null): number {
	if (raw == null || raw === "") return DEFAULT_FLAGS.scale;
	const n = Number(raw);
	if (!Number.isFinite(n) || n <= 0) return DEFAULT_FLAGS.scale;
	return Math.min(4, Math.max(0.25, n));
}

function parseLayout(raw: string | null): EmbedLayout {
	if (!raw) return DEFAULT_FLAGS.layout;
	const v = raw.trim().toLowerCase();
	if (LAYOUTS.has(v as EmbedLayout)) return v as EmbedLayout;
	return DEFAULT_FLAGS.layout;
}

/** Parse visual flags from a URLSearchParams / query object. */
export function parseEmbedFlags(params: URLSearchParams | Record<string, string | undefined>): EmbedFlags {
	const get = (key: string): string | null => {
		if (params instanceof URLSearchParams) return params.get(key);
		const v = params[key];
		return v == null ? null : String(v);
	};
	return {
		layout: parseLayout(get("layout")),
		art: parseBool(get("art"), DEFAULT_FLAGS.art),
		title: parseBool(get("title"), DEFAULT_FLAGS.title),
		artist: parseBool(get("artist"), DEFAULT_FLAGS.artist),
		progress: parseBool(get("progress"), DEFAULT_FLAGS.progress),
		transparent: parseBool(get("transparent"), DEFAULT_FLAGS.transparent),
		scale: parseScale(get("scale")),
	};
}

/** Read token from query (`token`). */
export function parseEmbedToken(params: URLSearchParams | Record<string, string | undefined>): string | null {
	const raw = params instanceof URLSearchParams ? params.get("token") : (params.token ?? null);
	if (raw == null) return null;
	const token = String(raw).trim();
	return token || null;
}

/**
 * Serialize flags (+ optional token) to query string.
 * Omits defaults so OBS URLs stay short.
 */
export function serializeEmbedFlags(options: Partial<EmbedUrlOptions>): string {
	const q = new URLSearchParams();
	const layout = options.layout ?? DEFAULT_FLAGS.layout;
	const art = options.art ?? DEFAULT_FLAGS.art;
	const title = options.title ?? DEFAULT_FLAGS.title;
	const artist = options.artist ?? DEFAULT_FLAGS.artist;
	const progress = options.progress ?? DEFAULT_FLAGS.progress;
	const transparent = options.transparent ?? DEFAULT_FLAGS.transparent;
	const scale = options.scale ?? DEFAULT_FLAGS.scale;

	if (layout !== DEFAULT_FLAGS.layout) q.set("layout", layout);
	if (!art) q.set("art", "0");
	if (!title) q.set("title", "0");
	if (!artist) q.set("artist", "0");
	if (!progress) q.set("progress", "0");
	if (!transparent) q.set("transparent", "0");
	if (scale !== DEFAULT_FLAGS.scale) q.set("scale", String(scale));

	const token = options.token?.trim();
	if (token) q.set("token", token);

	return q.toString();
}

export function defaultEmbedFlags(): EmbedFlags {
	return { ...DEFAULT_FLAGS };
}

/** Build full OBS browser-source URL. */
export function buildNowPlayingEmbedUrl(base: string, options: Partial<EmbedUrlOptions> = {}): string {
	const root = base.replace(/\/$/, "");
	const qs = serializeEmbedFlags(options);
	return qs ? `${root}/embed/now-playing?${qs}` : `${root}/embed/now-playing`;
}
