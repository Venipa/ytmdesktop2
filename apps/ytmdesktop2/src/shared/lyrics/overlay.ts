/**
 * Desktop lyrics overlay contract shared by the youtube preload plugin (publisher), the main
 * process (window owner / relay) and the `/lyrics-overlay` renderer route (consumer).
 */

export type LyricsOverlayLineStyle = "highlight" | "bar" | "fill";
export type LyricsOverlayAlign = "left" | "center" | "right";

export interface LyricsOverlaySettings {
	/** Overlay window open. */
	enabled: boolean;
	/** Click-through + unfocusable; position and size frozen. */
	locked: boolean;
	lineStyle: LyricsOverlayLineStyle;
	/** Active line font size (px). */
	fontSize: number;
	/** Unsung / inactive text colour (CSS colour). */
	textColor: string;
	/** Sung / active colour: fill sweep, stepped words, and the whole line in Highlight mode. */
	accentColor: string;
	/** Draw the upcoming line under the active one. */
	showNextLine: boolean;
	/** Next-line colour; alpha doubles as its opacity (#rrggbbaa). */
	nextLineColor: string;
	/** Crisp stroke around glyphs so text stays readable on light desktops. */
	textOutline: boolean;
	outlineColor: string;
	/** Stroke width (px). */
	outlineWidth: number;
	/** Soft drop shadow under the glyphs. */
	textShadow: boolean;
	shadowColor: string;
	/** Progress-bar mode: unplayed part of the pill behind the active line. */
	barBackground: string;
	/** Progress-bar mode: played part of the pill. */
	barProgressColor: string;
	align: LyricsOverlayAlign;
}

export const DEFAULT_LYRICS_OVERLAY_SETTINGS: LyricsOverlaySettings = {
	enabled: false,
	locked: false,
	lineStyle: "fill",
	fontSize: 30,
	textColor: "#ffffff",
	accentColor: "#5ab4ff",
	showNextLine: true,
	nextLineColor: "#ffffffb8",
	textOutline: true,
	outlineColor: "#000000cc",
	outlineWidth: 2,
	textShadow: true,
	shadowColor: "#00000099",
	barBackground: "#00000047",
	barProgressColor: "#5ab4ff73",
	align: "center",
};

export const LYRICS_OVERLAY_OUTLINE_WIDTH = { min: 0.5, max: 6 } as const;

export const LYRICS_OVERLAY_FONT_SIZE = { min: 14, max: 72 } as const;

/** Default overlay window size (DIP). Height fits two lines at the default font size. */
export const LYRICS_OVERLAY_DEFAULT_SIZE = { width: 900, height: 150 } as const;
export const LYRICS_OVERLAY_MIN_SIZE = { width: 320, height: 80 } as const;

function readBool(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function readColor(value: unknown, fallback: string): string {
	if (typeof value !== "string") return fallback;
	const v = value.trim();
	// Hex / rgb(a) / hsl(a) only — this string lands in a style attribute of a transparent window.
	if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return v;
	if (/^(?:rgb|hsl)a?\([\d.,%\s/]+\)$/i.test(v)) return v;
	return fallback;
}

export function readLyricsOverlayLineStyle(value: unknown): LyricsOverlayLineStyle {
	return value === "highlight" || value === "bar" || value === "fill" ? value : DEFAULT_LYRICS_OVERLAY_SETTINGS.lineStyle;
}

export function readLyricsOverlayFontSize(value: unknown): number {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(n)) return DEFAULT_LYRICS_OVERLAY_SETTINGS.fontSize;
	return Math.round(Math.min(LYRICS_OVERLAY_FONT_SIZE.max, Math.max(LYRICS_OVERLAY_FONT_SIZE.min, n)));
}

function readOutlineWidth(value: unknown): number {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(n)) return DEFAULT_LYRICS_OVERLAY_SETTINGS.outlineWidth;
	return Math.round(Math.min(LYRICS_OVERLAY_OUTLINE_WIDTH.max, Math.max(LYRICS_OVERLAY_OUTLINE_WIDTH.min, n)) * 2) / 2;
}

/** `#rrggbb[aa]` / `#rgb[a]` → 6-digit hex + 0..1 alpha (for a colour picker + opacity slider pair). */
export function splitHexColor(value: string): { hex: string; alpha: number } {
	const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value.trim());
	if (!m) return { hex: "#000000", alpha: 1 };
	let digits = m[1].toLowerCase();
	if (digits.length <= 4) digits = [...digits].map((c) => c + c).join("");
	const hex = `#${digits.slice(0, 6)}`;
	const alpha = digits.length === 8 ? Number.parseInt(digits.slice(6, 8), 16) / 255 : 1;
	return { hex, alpha };
}

/** Inverse of `splitHexColor`; drops the alpha digits when fully opaque. */
export function joinHexColor(hex: string, alpha: number): string {
	const { hex: base } = splitHexColor(hex);
	const a = Math.round(Math.min(1, Math.max(0, Number.isFinite(alpha) ? alpha : 1)) * 255);
	if (a >= 255) return base;
	return `${base}${a.toString(16).padStart(2, "0")}`;
}

/** Normalize the raw `lyrics.overlay` settings object (any shape) into a full settings record. */
export function readLyricsOverlaySettings(raw: unknown): LyricsOverlaySettings {
	const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
	const d = DEFAULT_LYRICS_OVERLAY_SETTINGS;
	return {
		enabled: readBool(s.enabled, d.enabled),
		locked: readBool(s.locked, d.locked),
		lineStyle: readLyricsOverlayLineStyle(s.lineStyle),
		fontSize: readLyricsOverlayFontSize(s.fontSize),
		textColor: readColor(s.textColor, d.textColor),
		accentColor: readColor(s.accentColor, d.accentColor),
		showNextLine: readBool(s.showNextLine, d.showNextLine),
		nextLineColor: readColor(s.nextLineColor, d.nextLineColor),
		textOutline: readBool(s.textOutline, d.textOutline),
		outlineColor: readColor(s.outlineColor, d.outlineColor),
		outlineWidth: readOutlineWidth(s.outlineWidth),
		textShadow: readBool(s.textShadow, d.textShadow),
		shadowColor: readColor(s.shadowColor, d.shadowColor),
		barBackground: readColor(s.barBackground, d.barBackground),
		barProgressColor: readColor(s.barProgressColor, d.barProgressColor),
		align: s.align === "left" || s.align === "right" ? s.align : "center",
	};
}

/** Structural twins of the lyrics plugin `LyricWord` / `LyricLine` (kept here so main/renderer never import the plugin). */
export interface LyricsOverlayWord {
	timeMs: number;
	text: string;
	durationMs: number;
}

export interface LyricsOverlayLine {
	timeMs: number;
	text: string;
	durationMs: number;
	parts?: string[];
	words?: LyricsOverlayWord[];
}

export type LyricsOverlaySnapshotStatus = "idle" | "loading" | "ready" | "plain" | "empty" | "disabled";

/** What the overlay draws for the current track. Sent once per change, not per frame. */
export interface LyricsOverlaySnapshot {
	status: LyricsOverlaySnapshotStatus;
	videoId: string | null;
	title: string;
	artists: string[];
	/** Timed lines when `status === "ready"`. */
	lines: LyricsOverlayLine[] | null;
	hasWordSync: boolean;
}

export const EMPTY_LYRICS_OVERLAY_SNAPSHOT: LyricsOverlaySnapshot = {
	status: "idle",
	videoId: null,
	title: "",
	artists: [],
	lines: null,
	hasWordSync: false,
};

/**
 * Playback clock sync packet. The overlay extrapolates from `timeMs` using its own clock while
 * `playing`, so the publisher only needs to resend on play/pause/seek and a slow heartbeat.
 */
export interface LyricsOverlayClock {
	/** Player time at `at` (ms, display lead already applied). */
	timeMs: number;
	playing: boolean;
	/** `Date.now()` on the publisher when `timeMs` was read. */
	at: number;
}

export function resolveLyricsOverlayTimeMs(clock: LyricsOverlayClock | null | undefined, nowMs: number): number {
	if (!clock) return 0;
	if (!clock.playing) return clock.timeMs;
	const elapsed = nowMs - clock.at;
	return clock.timeMs + (elapsed > 0 ? elapsed : 0);
}

export interface LyricsOverlayWindowState {
	open: boolean;
	locked: boolean;
}

/** Preload plugin → main (ipcRenderer.send). */
export const LYRICS_OVERLAY_IPC = {
	snapshot: "lyrics:overlay-snapshot",
	clock: "lyrics:overlay-clock",
} as const;

/** Main bus → overlay window tRPC subscriptions (`fromIpcEvent`). */
export const LYRICS_OVERLAY_EVENTS = {
	snapshot: "lyrics.overlay.snapshot",
	clock: "lyrics.overlay.clock",
	state: "lyrics.overlay.state",
} as const;
