export interface LyricLine {
	timeMs: number;
	/** Primary display / a11y text (joined parts when concurrent). */
	text: string;
	durationMs: number;
	/** Concurrent voices when several LRC lines start nearly together. */
	parts?: string[];
}

export interface LyricResult {
	title: string;
	artists: string[];
	lines?: LyricLine[];
	plain?: string;
	inexact?: boolean;
	provider: "lrclib";
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

export type LyricsStatus = "idle" | "loading" | "ready" | "empty" | "error" | "skipped";

export interface LyricsViewState {
	status: LyricsStatus;
	result: LyricResult | null;
	activeIndex: number;
	timeMs: number;
	errorMessage?: string;
	showTimeCodes: boolean;
}
