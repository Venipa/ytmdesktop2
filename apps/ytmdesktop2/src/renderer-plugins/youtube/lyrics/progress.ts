import type { LyricWord } from "./types";

/** Absolute playback time keeps fills correct through pauses, seeks and overlapping cues. */
export function wordProgress(word: LyricWord, timeMs: number): number {
	if (!Number.isFinite(timeMs) || !Number.isFinite(word.timeMs) || timeMs < word.timeMs) return 0;
	if (!Number.isFinite(word.durationMs)) return 0;
	if (word.durationMs <= 0) return 1;
	return Math.min(1, (timeMs - word.timeMs) / word.durationMs);
}
