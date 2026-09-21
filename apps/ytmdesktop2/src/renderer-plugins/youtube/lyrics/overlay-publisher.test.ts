import type { LyricsOverlayClock, LyricsOverlaySnapshot } from "@shared/lyrics/overlay";
import { describe, expect, it } from "vitest";
import {
	createOverlayPublisher,
	OVERLAY_CLOCK_DRIFT_MS,
	OVERLAY_CLOCK_HEARTBEAT_MS,
	toOverlaySnapshot,
} from "./overlay-publisher";
import type { LyricsStoreSnapshot } from "./store";
import type { LyricResult } from "./types";

const result: LyricResult = {
	title: "Song",
	artists: ["Artist"],
	provider: "lrclib",
	lines: [
		{ timeMs: 0, text: "one", durationMs: 1000 },
		{ timeMs: 1000, text: "two", durationMs: 1000 },
	],
};

function harness() {
	const snapshots: LyricsOverlaySnapshot[] = [];
	const clocks: LyricsOverlayClock[] = [];
	let now = 1_000;
	const publisher = createOverlayPublisher(
		{ sendSnapshot: (s) => snapshots.push(s), sendClock: (c) => clocks.push(c) },
		() => now,
	);
	return { publisher, snapshots, clocks, advance: (ms: number) => (now += ms) };
}

describe("toOverlaySnapshot", () => {
	it("maps timed results to ready, plain results to plain, misses to empty", () => {
		const base: LyricsStoreSnapshot = { status: "ready", result, videoId: "v1" };
		expect(toOverlaySnapshot(base, true)).toMatchObject({ status: "ready", videoId: "v1", title: "Song", artists: ["Artist"] });
		expect(toOverlaySnapshot(base, true).lines).toBe(result.lines);
		expect(toOverlaySnapshot({ ...base, result: { ...result, lines: undefined, plain: "text" } }, true).status).toBe("plain");
		expect(toOverlaySnapshot({ status: "empty", result: null, videoId: "v1" }, true).status).toBe("empty");
		expect(toOverlaySnapshot({ status: "error", result: null, videoId: "v1", errorMessage: "x" }, true).status).toBe("empty");
		expect(toOverlaySnapshot({ status: "loading", result: null, videoId: "v1" }, true).status).toBe("loading");
	});

	it("reports disabled regardless of store state when the plugin is off", () => {
		expect(toOverlaySnapshot({ status: "ready", result, videoId: "v1" }, false)).toMatchObject({ status: "disabled", lines: null });
	});
});

describe("createOverlayPublisher", () => {
	it("holds snapshots while disabled and replays the latest one on enable", () => {
		const { publisher, snapshots } = harness();
		publisher.setSnapshot(toOverlaySnapshot({ status: "loading", result: null, videoId: "v1" }, true));
		publisher.setSnapshot(toOverlaySnapshot({ status: "ready", result, videoId: "v1" }, true));
		expect(snapshots).toHaveLength(0);
		publisher.setEnabled(true);
		expect(snapshots).toHaveLength(1);
		expect(snapshots[0].status).toBe("ready");
	});

	it("skips duplicate snapshots", () => {
		const { publisher, snapshots } = harness();
		publisher.setEnabled(true);
		const snap = toOverlaySnapshot({ status: "ready", result, videoId: "v1" }, true);
		publisher.setSnapshot(snap);
		publisher.setSnapshot({ ...snap });
		expect(snapshots).toHaveLength(1);
	});

	it("sends a clock on first tick, on play/pause, on drift and on the heartbeat only", () => {
		const { publisher, clocks, advance } = harness();
		publisher.tick(0, true);
		expect(clocks).toHaveLength(0); // disabled → nothing

		publisher.setEnabled(true);
		publisher.tick(1000, true);
		expect(clocks).toEqual([{ timeMs: 1000, playing: true, at: 1000 }]);

		// Steady playback: extrapolation matches → silent.
		advance(500);
		publisher.tick(1500, true);
		advance(500);
		publisher.tick(2000 + OVERLAY_CLOCK_DRIFT_MS / 2, true);
		expect(clocks).toHaveLength(1);

		// Seek → drift beyond tolerance.
		advance(100);
		publisher.tick(30_000, true);
		expect(clocks).toHaveLength(2);
		expect(clocks[1]).toMatchObject({ timeMs: 30_000, playing: true });

		// Pause → state change.
		advance(200);
		publisher.tick(30_200, false);
		expect(clocks).toHaveLength(3);
		expect(clocks[2].playing).toBe(false);

		// Paused and still: silent until the heartbeat.
		advance(OVERLAY_CLOCK_HEARTBEAT_MS - 1);
		publisher.tick(30_200, false);
		expect(clocks).toHaveLength(3);
		advance(1);
		publisher.tick(30_200, false);
		expect(clocks).toHaveLength(4);
	});

	it("resends after resetClock and after a disable/enable cycle", () => {
		const { publisher, clocks, advance } = harness();
		publisher.setEnabled(true);
		publisher.tick(0, true);
		advance(16);
		publisher.resetClock();
		publisher.tick(16, true);
		expect(clocks).toHaveLength(2);
		publisher.setEnabled(false);
		publisher.setEnabled(true);
		advance(16);
		publisher.tick(32, true);
		expect(clocks).toHaveLength(3);
	});
});
