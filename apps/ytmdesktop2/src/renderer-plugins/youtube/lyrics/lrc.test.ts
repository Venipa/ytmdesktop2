import { describe, expect, it } from "vitest";
import {
	activeLineIndex,
	activeLineIndices,
	activeWordIndex,
	groupConcurrentLines,
	parseLrc,
	primaryActiveLineIndex,
} from "./lrc";

describe("parseLrc", () => {
	it("parses timed lines, offset, and enhanced words", () => {
		const lines = parseLrc(`
[offset:200]
[00:01.00]<00:01.00>Hello <00:01.50>world
[00:03.00]plain
`);
		const enhanced = lines.find((l) => l.words?.length);
		expect(enhanced?.timeMs).toBe(1200);
		expect(enhanced?.words?.[0]).toMatchObject({ timeMs: 1200, text: "Hello " });
		expect(lines.find((l) => l.text === "plain")?.words).toBeUndefined();
	});

	it("groups near-simultaneous duet lines", () => {
		const lines = parseLrc(`[00:01.00]Voice one\n[00:01.12]Voice two\n[00:04.00]Later`);
		expect(lines.find((l) => l.parts?.length === 2)).toMatchObject({
			text: "Voice one\nVoice two",
			parts: ["Voice one", "Voice two"],
		});
	});
});

describe("active indices", () => {
	it("picks line and word windows", () => {
		const lines = parseLrc(`[00:00.00]A\n[00:02.00]B\n[00:04.00]C`);
		expect(activeLineIndex(lines, 2500)).toBe(1);

		const overlap = [
			{ timeMs: 10000, text: "one", durationMs: 5000 },
			{ timeMs: 12500, text: "two", durationMs: 4000 },
		];
		expect(activeLineIndices(overlap, 13000)).toEqual([0, 1]);
		expect(primaryActiveLineIndex(overlap, 13000)).toBe(1);

		const words = [
			{ timeMs: 1000, text: "a", durationMs: 500 },
			{ timeMs: 1500, text: "b", durationMs: 500 },
		];
		expect(activeWordIndex(words, 1499)).toBe(0);
		expect(activeWordIndex(words, 1500)).toBe(1);
	});

	it("merges concurrent starts", () => {
		const grouped = groupConcurrentLines([
			{ timeMs: 0, text: "A", durationMs: 100 },
			{ timeMs: 100, text: "B", durationMs: 2900 },
			{ timeMs: 3000, text: "C", durationMs: Infinity },
		]);
		expect(grouped).toHaveLength(2);
		expect(grouped[0].parts).toEqual(["A", "B"]);
	});
});
