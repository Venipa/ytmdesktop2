import { searchLyrics } from "./providers/search";
import { resolveLyricsDisplay, setLyricsTabDisplayMode, ytmHasStockLyrics } from "./stock";
import type { LyricResult, LyricsStatus, TrackSearchInfo } from "./types";

export interface LyricsStoreSnapshot {
	status: LyricsStatus;
	result: LyricResult | null;
	videoId: string | null;
	errorMessage?: string;
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
		return { ...snap, status: "stock", errorMessage: undefined };
	}
	return snap;
}

export function createLyricsStore() {
	const cache = new Map<string, LyricResult | null>();
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
			snap = { status: "idle", result: null, videoId: null, errorMessage: undefined };
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
			});
		},
		/** If lyrics already cached for videoId, apply immediately (skip loading wait). */
		applyCacheIfPresent(videoId: string): boolean {
			if (!cache.has(videoId)) return false;
			const cached = cache.get(videoId) ?? null;
			abort?.abort();
			abort = null;
			generation += 1;
			setSnap({
				status: cached ? "ready" : "empty",
				result: cached,
				videoId,
				errorMessage: undefined,
			});
			return true;
		},
		/**
		 * Background-fetch lyrics into cache. Does not touch UI snapshot.
		 * Safe to call for queue "up next" while current track is showing.
		 */
		prefetchForTrack(
			info: TrackSearchInfo,
			options: { showEvenIfInexact: boolean; providers?: unknown },
		): void {
			if (!info.videoId || cache.has(info.videoId)) return;
			stopPrefetch();
			prefetchAbort = new AbortController();
			const signal = prefetchAbort.signal;
			void searchLyrics(info, {
				showEvenIfInexact: options.showEvenIfInexact,
				providers: options.providers,
				signal,
			})
				.then((result) => {
					if (signal.aborted) return;
					if (!cache.has(info.videoId)) cache.set(info.videoId, result);
				})
				.catch(() => {
					/* prefetch failures stay silent */
				});
		},
		async fetchForTrack(
			info: TrackSearchInfo,
			options: { showEvenIfInexact: boolean; providers?: unknown },
		): Promise<void> {
			const cached = cache.get(info.videoId);
			if (cached !== undefined) {
				setSnap({
					status: cached ? "ready" : "empty",
					result: cached,
					videoId: info.videoId,
					errorMessage: undefined,
				});
				return;
			}

			abort?.abort();
			abort = new AbortController();
			const gen = ++generation;
			const signal = abort.signal;
			setSnap({ status: "loading", result: null, videoId: info.videoId, errorMessage: undefined });

			try {
				const result = await searchLyrics(info, {
					showEvenIfInexact: options.showEvenIfInexact,
					providers: options.providers,
					signal,
				});
				if (gen !== generation) return;
				cache.set(info.videoId, result);
				setSnap({
					status: result ? "ready" : "empty",
					result,
					videoId: info.videoId,
					errorMessage: undefined,
				});
			} catch (err) {
				if (signal.aborted || gen !== generation) return;
				const message = err instanceof Error ? err.message : String(err);
				setSnap({
					status: "error",
					result: null,
					videoId: info.videoId,
					errorMessage: message,
				});
			}
		},
	};
}

export type LyricsStore = ReturnType<typeof createLyricsStore>;
