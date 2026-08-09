import { describe, expect, it } from "vitest";
import { pickBest, rankLrcLibHits } from "./lrclib";

const baseHit = {
	id: 1,
	trackName: "Test",
	artistName: "Artist",
	albumName: "Album",
	duration: 200,
	instrumental: false,
	plainLyrics: "hello",
	syncedLyrics: "[00:01.00] hello",
};

const info = {
	videoId: "x",
	title: "Test",
	artist: "Artist",
	durationSec: 200,
};

describe("pickBest / rankLrcLibHits", () => {
	it("prefers closer duration", () => {
		const close = { ...baseHit, id: 1, duration: 200 };
		const far = { ...baseHit, id: 2, duration: 230 };
		expect(pickBest([far, close], info, true)?.hit.id).toBe(1);
		expect(rankLrcLibHits([far, close], info)[0].hit.id).toBe(1);
	});

	it("marks inexact when outside tolerance", () => {
		const far = { ...baseHit, duration: 250 };
		const picked = pickBest([far], { ...info, durationSec: 200 }, true);
		expect(picked).toMatchObject({ inexact: true, hit: { duration: 250 } });
		expect(pickBest([far], info, false)).toBeNull();
	});
});
