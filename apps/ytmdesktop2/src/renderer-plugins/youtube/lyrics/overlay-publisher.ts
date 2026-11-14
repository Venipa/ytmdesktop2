import {
	EMPTY_LYRICS_OVERLAY_SNAPSHOT,
	type LyricsOverlayClock,
	type LyricsOverlaySnapshot,
} from "@shared/lyrics/overlay";
import type { LyricsStoreSnapshot } from "./store";

/** Resend the clock when the overlay's extrapolation would be off by more than this (seek / stall). */
export const OVERLAY_CLOCK_DRIFT_MS = 90;
/** Heartbeat so a missed packet self-heals and rate drift never accumulates. */
export const OVERLAY_CLOCK_HEARTBEAT_MS = 1500;

export interface OverlayPublisherTransport {
	sendSnapshot(snap: LyricsOverlaySnapshot): void;
	sendClock(clock: LyricsOverlayClock): void;
}

/** Map the in-tab lyrics store snapshot onto the (smaller) overlay contract. */
export function toOverlaySnapshot(snap: LyricsStoreSnapshot, lyricsEnabled: boolean): LyricsOverlaySnapshot {
	if (!lyricsEnabled) return { ...EMPTY_LYRICS_OVERLAY_SNAPSHOT, status: "disabled" };
	const result = snap.result;
	const base = {
		videoId: snap.videoId,
		title: result?.title ?? "",
		artists: result?.artists ?? [],
		hasWordSync: !!result?.hasWordSync,
	};
	switch (snap.status) {
		case "loading":
			return { ...base, status: "loading", lines: null };
		case "ready":
		case "stock": {
			if (result?.lines?.length) return { ...base, status: "ready", lines: result.lines };
			if (result?.plain) return { ...base, status: "plain", lines: null };
			return { ...base, status: "empty", lines: null };
		}
		case "empty":
		case "error":
		case "skipped":
			return { ...base, status: "empty", lines: null };
		default:
			return { ...base, status: "idle", lines: null };
	}
}

function sameSnapshot(a: LyricsOverlaySnapshot | null, b: LyricsOverlaySnapshot): boolean {
	if (!a) return false;
	return a.status === b.status && a.videoId === b.videoId && a.lines === b.lines && a.title === b.title;
}

/**
 * Publishes lyrics + a low-rate playback clock to the desktop overlay.
 * Snapshots go out on change only; clock packets go out on play/pause, on drift (seek) and on a heartbeat,
 * so the ~30 Hz page tick never becomes a ~30 Hz IPC stream.
 */
export function createOverlayPublisher(transport: OverlayPublisherTransport, now: () => number = () => Date.now()) {
	let enabled = false;
	let lastSnapshot: LyricsOverlaySnapshot | null = null;
	let lastClock: LyricsOverlayClock | null = null;

	const flushSnapshot = () => {
		if (lastSnapshot) transport.sendSnapshot(lastSnapshot);
	};

	return {
		isEnabled(): boolean {
			return enabled;
		},
		/** Overlay open/closed. Enabling replays the last snapshot so a fresh window has content. */
		setEnabled(next: boolean): void {
			if (next === enabled) return;
			enabled = next;
			lastClock = null;
			if (enabled) flushSnapshot();
		},
		setSnapshot(snap: LyricsOverlaySnapshot): void {
			if (sameSnapshot(lastSnapshot, snap)) return;
			lastSnapshot = snap;
			if (enabled) transport.sendSnapshot(snap);
		},
		/** Playback tick from the page clock. `timeMs` should already include the display lead. */
		tick(timeMs: number, playing: boolean): void {
			if (!enabled) return;
			const at = now();
			let send = !lastClock || lastClock.playing !== playing;
			if (!send && lastClock) {
				const expected = lastClock.playing ? lastClock.timeMs + (at - lastClock.at) : lastClock.timeMs;
				send = Math.abs(timeMs - expected) > OVERLAY_CLOCK_DRIFT_MS || at - lastClock.at >= OVERLAY_CLOCK_HEARTBEAT_MS;
			}
			if (!send) return;
			lastClock = { timeMs, playing, at };
			transport.sendClock(lastClock);
		},
		/** Force the next tick to resend (track change / clock restart). */
		resetClock(): void {
			lastClock = null;
		},
	};
}

export type OverlayPublisher = ReturnType<typeof createOverlayPublisher>;
