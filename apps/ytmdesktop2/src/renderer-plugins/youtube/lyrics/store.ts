import { searchLrcLib } from "./providers/lrclib";
import type { LyricResult, LyricsStatus, TrackSearchInfo } from "./types";

export interface LyricsStoreSnapshot {
	status: LyricsStatus;
	result: LyricResult | null;
	videoId: string | null;
	errorMessage?: string;
}

type Listener = (snap: LyricsStoreSnapshot) => void;

export function createLyricsStore() {
	const cache = new Map<string, LyricResult | null>();
	let abort: AbortController | null = null;
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
		snap = { ...snap, ...partial };
		emit();
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
			generation += 1;
			setSnap({ status: "idle", result: null, videoId: null, errorMessage: undefined });
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
		async fetchForTrack(
			info: TrackSearchInfo,
			options: { showEvenIfInexact: boolean },
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
				const result = await searchLrcLib(info, {
					showEvenIfInexact: options.showEvenIfInexact,
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
