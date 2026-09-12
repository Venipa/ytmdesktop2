/**
 * How the active line shows progress when the provider only has line timing (no word/syllable cues).
 * - `highlight`: light the line up (and enlarge it with Dynamic lyrics) — no progress indicator.
 * - `bar`: row background that advances with playback.
 * - `fill`: text colour that advances with playback (constant rate — drifts from the vocal).
 */
export type LyricsLineStyle = "highlight" | "bar" | "fill";

export const DEFAULT_LINE_STYLE: LyricsLineStyle = "highlight";

export function readLineStyle(value: unknown): LyricsLineStyle {
	return value === "bar" || value === "fill" ? value : DEFAULT_LINE_STYLE;
}
