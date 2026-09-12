import { searchLyricsDetailed } from "./providers/search";
import { resolveLyricsDisplay, setLyricsTabDisplayMode, ytmHasStockLyrics } from "./stock";
import type { LyricResult, LyricsMissReason, LyricsStatus, TrackSearchInfo } from "./types";

export interface LyricsStoreSnapshot {
	status: LyricsStatus;
	result: LyricResult | null;
	videoId: string | null;
	errorMessage?: string;
	/** Why Better Lyrics came back empty (only meaningful when `status === "empty"`). */
	betterLyricsMiss?: LyricsMissReason;
}

export interface LyricsFetchOptions {
	showEvenIfInexact: boolean;
	providers?: unknown;
	betterLyricsApiKey?: string;
	preferWordSync?: boolean;
}

interface CacheEntry {
	result: LyricResult | null;
	betterLyricsMiss?: LyricsMissReason;
}

type Listener = (snap: LyricsStoreSnapshot) => void;

function applyDisplay(snap: LyricsStoreSnapshot): LyricsStoreSnapshot {
	const hasTimedLines = !!snap.result?.lines?.length;
	const resolved = resolveLyricsDisplay({
		status: snap.status,
		hasTimedLines,
		hasStock: ytmHasStockLyrics(),
	});
	setLyricsTabDisplayMode(resolved.mode);
	if (resolved.status === "stock") {
		return { ...snap, status: "stock", errorMessage: undefined, betterLyricsMiss: undefined };
	}
	return snap;
}

function snapFromEntry(entry: CacheEntry, videoId: string): LyricsStoreSnapshot {
	return {
		status: entry.result ? "ready" : "empty",
		result: entry.result,
		videoId,
		errorMessage: undefined,
		betterLyricsMiss: entry.result ? undefined : entry.betterLyricsMiss,
	};
}

export function createLyricsStore() {
	const cache = new Map<string, CacheEntry>();
	let abort: AbortController | null = null;
	let prefetchAbort: AbortController | null = null;
	let generation = 0;
	let snap: LyricsStoreSnapshot = {
		status: "idle",
		result: null,
		videoId: null,
	};
	const listeners = new Set<Listener>();

	const emit = () => {
		for (const fn of listeners) fn(snap);
	};

	const setSnap = (partial: Partial<LyricsStoreSnapshot>) => {
		snap = applyDisplay({ ...snap, ...partial });
		emit();
	};

	const stopPrefetch = () => {
		prefetchAbort?.abort();
		prefetchAbort = null;
	};

	return {
		subscribe(fn: Listener): () => void {
			listeners.add(fn);
			fn(snap);
			return () => listeners.delete(fn);
		},
		getSnapshot(): LyricsStoreSnapshot {
			return snap;
		},
		clear() {
			abort?.abort();
			abort = null;
			stopPrefetch();
			generation += 1;
			cache.clear();
			setLyricsTabDisplayMode("overlay");
			snap = { status: "idle", result: null, videoId: null, errorMessage: undefined, betterLyricsMiss: undefined };
			emit();
		},
		clearCache() {
			cache.clear();
		},
		setSkipped(videoId: string | null, reason?: string) {
			abort?.abort();
			abort = null;
			generation += 1;
			setSnap({
				status: "skipped",
				result: null,
				videoId,
				errorMessage: reason,
				betterLyricsMiss: undefined,
			});
		},
		/** Show loading while waiting for player meta after trackId:change. */
		setLoading(videoId: string | null) {
			abort?.abort();
			abort = null;
			generation += 1;
			setSnap({
				status: "loading",
				result: null,
				videoId,
				errorMessage: undefined,
				betterLyricsMiss: undefined,
			});
		},
		/** If lyrics already cached for videoId, apply immediately (skip loading wait). */
		applyCacheIfPresent(videoId: string): boolean {
			const cached = cache.get(videoId);
			if (!cached) return false;
			abort?.abort();
			abort = null;
			generation += 1;
			setSnap(snapFromEntry(cached, videoId));
			return true;
		},
		/**
		 * Background-fetch lyrics into cache. Does not touch UI snapshot.
		 * Safe to call for queue "up next" while current track is showing.
		 */
		prefetchForTrack(info: TrackSearchInfo, options: LyricsFetchOptions): void {
			if (!info.videoId || cache.has(info.videoId)) return;
			stopPrefetch();
			prefetchAbort = new AbortController();
			const signal = prefetchAbort.signal;
			void searchLyricsDetailed(info, { ...options, signal, prefetch: true })
				.then((outcome) => {
					if (signal.aborted || cache.has(info.videoId)) return;
					// A partial prefetch (current-video-only providers skipped) is only trustworthy on a timed hit;
					// otherwise let the real fetch run the full chain when the track actually plays.
					if (outcome.partial && !outcome.result?.lines?.length) return;
					cache.set(info.videoId, outcome);
				})
				.catch(() => {
					/* prefetch failures stay silent */
				});
		},
		async fetchForTrack(info: TrackSearchInfo, options: LyricsFetchOptions): Promise<void> {
			const cached = cache.get(info.videoId);
			if (cached) {
				setSnap(snapFromEntry(cached, info.videoId));
				return;
			}

			abort?.abort();
			abort = new AbortController();
			const gen = ++generation;
			const signal = abort.signal;
			setSnap({
				status: "loading",
				result: null,
				videoId: info.videoId,
				errorMessage: undefined,
				betterLyricsMiss: undefined,
			});

			try {
				const outcome = await searchLyricsDetailed(info, { ...options, signal });
				if (gen !== generation) return;
				cache.set(info.videoId, outcome);
				setSnap(snapFromEntry(outcome, info.videoId));
			} catch (err) {
				if (signal.aborted || gen !== generation) return;
				const message = err instanceof Error ? err.message : String(err);
				setSnap({
					status: "error",
					result: null,
					videoId: info.videoId,
					errorMessage: message,
					betterLyricsMiss: undefined,
				});
			}
		},
	};
}

export type LyricsStore = ReturnType<typeof createLyricsStore>;
