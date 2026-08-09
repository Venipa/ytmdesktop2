/** Timed word/syllable cue. */
export interface LyricWord {
	timeMs: number;
	text: string;
	durationMs: number;
}

export interface LyricLine {
	timeMs: number;
	/** Primary display / a11y text (joined parts when concurrent). */
	text: string;
	durationMs: number;
	/** Concurrent voices when several LRC lines start nearly together. */
	parts?: string[];
	/** Word/syllable cues when the provider returns them. */
	words?: LyricWord[];
}

export type LyricsSyncLevel = "syllable" | "word" | "line" | "plain";

export interface LyricResult {
	title: string;
	artists: string[];
	lines?: LyricLine[];
	plain?: string;
	inexact?: boolean;
	provider: "lrclib" | "better-lyrics" | "unison";
	/** True when result includes real word/syllable cues. */
	hasWordSync?: boolean;
	syncLevel?: LyricsSyncLevel;
}

export interface TrackSearchInfo {
	videoId: string;
	title: string;
	artist: string;
	album?: string;
	durationSec: number;
	musicVideoType?: string;
	isLiveContent?: boolean;
}

export type LyricsStatus = "idle" | "loading" | "ready" | "empty" | "error" | "skipped" | "stock";

export interface LyricsViewState {
	status: LyricsStatus;
	result: LyricResult | null;
	activeIndex: number;
	timeMs: number;
	errorMessage?: string;
	showTimeCodes: boolean;
}
