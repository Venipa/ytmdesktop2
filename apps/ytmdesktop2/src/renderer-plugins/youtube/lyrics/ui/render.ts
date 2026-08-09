import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
	LyricsApp,
	type LyricsClockState,
	type LyricsShellState,
	type LyricsUiOptions,
} from "./LyricsApp";
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
 * Shell store (snap/settings) separate from clock store (rAF time) so inactive lines skip reconcile.
 */
export function createLyricsRenderer(
	getHost: () => HTMLElement | null,
	options: LyricsUiOptions,
): LyricsRenderApi {
	let root: Root | null = null;
	let mountedHost: HTMLElement | null = null;
	let disposed = false;

	let shell: LyricsShellState = {
		snap: { status: "idle", result: null, videoId: null },
		showTimeCodes: options.showTimeCodes(),
		showProgressBar: options.showProgressBar(),
		settingsEpoch: 0,
	};
	let clock: LyricsClockState = { timeMs: 0 };

	const shellListeners = new Set<() => void>();
	const clockListeners = new Set<() => void>();

	const subscribeShell = (onStoreChange: () => void) => {
		shellListeners.add(onStoreChange);
		return () => shellListeners.delete(onStoreChange);
	};
	const subscribeClock = (onStoreChange: () => void) => {
		clockListeners.add(onStoreChange);
		return () => clockListeners.delete(onStoreChange);
	};

	const getShell = () => shell;
	const getClock = () => clock;

	const emitShell = () => {
		for (const fn of shellListeners) fn();
	};
	const emitClock = () => {
		for (const fn of clockListeners) fn();
	};

	const patchShell = (partial: Partial<LyricsShellState>) => {
		shell = { ...shell, ...partial };
		emitShell();
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
				subscribeShell,
				getShell,
				subscribeClock,
				getClock,
				onSeek: options.onSeek,
			}),
		);
		return true;
	};

	ensureRoot();

	return {
		setSnapshot(snap) {
			patchShell({ snap });
			ensureRoot();
		},
		setTime(ms) {
			if (clock.timeMs === ms) return;
			clock = { timeMs: ms };
			emitClock();
		},
		repaint() {
			patchShell({
				showTimeCodes: options.showTimeCodes(),
				showProgressBar: options.showProgressBar(),
				settingsEpoch: shell.settingsEpoch + 1,
			});
			ensureRoot();
		},
		destroy() {
			disposed = true;
			unmountRoot();
			const host = getHost();
			host?.replaceChildren();
			shellListeners.clear();
			clockListeners.clear();
		},
	};
}
