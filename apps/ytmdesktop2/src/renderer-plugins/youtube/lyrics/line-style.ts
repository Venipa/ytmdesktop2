/**
 * How the active line shows progress.
 * - `highlight`: light the line up; word/syllable cues step word by word — no extra indicator.
 * - `bar`: line-only cues get a row background that advances with playback (constant rate — line
 *   timing has no per-word pacing). Word-synced lines behave like `highlight`.
 * - `fill`: word/syllable cues sweep each word's colour left → right over its duration. Line-only
 *   cues fall back to `highlight`, since a constant-rate fill would only guess where the vocal is.
 */
export type LyricsLineStyle = "highlight" | "bar" | "fill";

export const DEFAULT_LINE_STYLE: LyricsLineStyle = "fill";

export function readLineStyle(value: unknown): LyricsLineStyle {
	return value === "bar" || value === "fill" ? value : DEFAULT_LINE_STYLE;
}
