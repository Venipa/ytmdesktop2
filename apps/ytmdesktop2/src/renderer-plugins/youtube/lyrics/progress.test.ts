import { describe, expect, it } from "vitest";
import { wordProgress } from "./progress";

describe("wordProgress", () => {
	const word = { text: "Hello", timeMs: 1000, durationMs: 2000 };

	it("fills a sustained syllable and stays filled during the following gap", () => {
		expect([500, 1000, 1500, 2000, 3000, 4000].map((time) => wordProgress(word, time))).toEqual([0, 0, 0.25, 0.5, 1, 1]);
	});

	it("follows playback time through pauses and backward seeks", () => {
		expect([2500, 2500, 1500].map((time) => wordProgress(word, time))).toEqual([0.75, 0.75, 0.25]);
	});

	it("fills overlapping cues independently", () => {
		expect(wordProgress(word, 2000)).toBe(0.5);
		expect(wordProgress({ ...word, timeMs: 1500, durationMs: 2000 }, 2000)).toBe(0.25);
	});

	it("handles instantaneous and invalid cues without invalid CSS values", () => {
		for (const durationMs of [0, -1]) {
			expect(wordProgress({ ...word, durationMs }, 999)).toBe(0);
			expect(wordProgress({ ...word, durationMs }, 1000)).toBe(1);
		}
		expect(wordProgress({ ...word, durationMs: Infinity }, 2000)).toBe(0);
		expect(wordProgress({ ...word, timeMs: NaN }, 2000)).toBe(0);
		expect(wordProgress(word, NaN)).toBe(0);
	});
});
