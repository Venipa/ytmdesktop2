import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LyricsApp, type LyricsUiOptions, type LyricsUiState } from "./LyricsApp";
import type { LyricsStoreSnapshot } from "../store";

export interface LyricsRenderApi {
	setSnapshot(snap: LyricsStoreSnapshot): void;
	setTime(timeMs: number, durationMs?: number): void;
	/** Force re-bind to host (host recreate / settings like showTimeCodes). */
	repaint(): void;
	destroy(): void;
}

/**
 * React createRoot bridge into `#ytmd-lyrics-root`.
 * High-freq setTime uses an external store (no remount per rAF tick).
 */
export function createLyricsRenderer(
	getHost: () => HTMLElement | null,
	options: LyricsUiOptions,
): LyricsRenderApi {
	let root: Root | null = null;
	let mountedHost: HTMLElement | null = null;
	let disposed = false;

	let state: LyricsUiState = {
		snap: { status: "idle", result: null, videoId: null },
		timeMs: 0,
		showTimeCodes: options.showTimeCodes(),
		showProgressBar: options.showProgressBar(),
		settingsEpoch: 0,
	};

	const listeners = new Set<() => void>();

	const subscribe = (onStoreChange: () => void) => {
		listeners.add(onStoreChange);
		return () => listeners.delete(onStoreChange);
	};

	const getSnapshot = () => state;

	const emit = () => {
		for (const fn of listeners) fn();
	};

	const patch = (partial: Partial<LyricsUiState>) => {
		state = { ...state, ...partial };
		emit();
	};

	const unmountRoot = () => {
		if (!root) return;
		try {
			root.unmount();
		} catch {
			/* host may already be gone */
		}
		root = null;
		mountedHost = null;
	};

	const ensureRoot = (): boolean => {
		if (disposed) return false;
		const host = getHost();
		if (!host) {
			unmountRoot();
			return false;
		}
		if (root && mountedHost === host) return true;
		unmountRoot();
		mountedHost = host;
		root = createRoot(host);
		root.render(
			createElement(LyricsApp, {
				subscribe,
				getSnapshot,
				onSeek: options.onSeek,
			}),
		);
		return true;
	};

	ensureRoot();

	return {
		setSnapshot(snap) {
			patch({ snap });
			ensureRoot();
		},
		setTime(ms) {
			if (state.timeMs === ms) return;
			patch({ timeMs: ms });
		},
		repaint() {
			patch({
				showTimeCodes: options.showTimeCodes(),
				showProgressBar: options.showProgressBar(),
				settingsEpoch: state.settingsEpoch + 1,
			});
			unmountRoot();
			ensureRoot();
		},
		destroy() {
			disposed = true;
			unmountRoot();
			const host = getHost();
			host?.replaceChildren();
			host?.classList.remove("has-progress");
			listeners.clear();
		},
	};
}
