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
	provider: "lrclib" | "better-lyrics" | "unison" | "youtube-captions";
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

/** One caption track on the current player video, normalized from the page world. */
export interface YouTubeCaptionTrack {
	languageCode: string;
	/** `timedtext` URL (signed by YTM; short-lived). */
	url: string;
	/** Auto-generated (ASR) track. */
	isAuto: boolean;
	name: string;
}

export interface YouTubeCaptionTracks {
	videoId: string;
	tracks: YouTubeCaptionTrack[];
}

export type LyricsStatus = "idle" | "loading" | "ready" | "empty" | "error" | "skipped" | "stock";

/**
 * Why a provider returned nothing. `uncached` / `invalid-key` come from Better Lyrics'
 * cache-first auth model (401 on a cache miss) and are surfaced as a hint in the empty state.
 */
export type LyricsMissReason = "not-found" | "uncached" | "invalid-key" | "rate-limited";

export interface LyricsViewState {
	status: LyricsStatus;
	result: LyricResult | null;
	activeIndex: number;
	timeMs: number;
	errorMessage?: string;
	showTimeCodes: boolean;
}
