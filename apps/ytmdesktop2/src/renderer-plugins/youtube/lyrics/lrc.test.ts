import { describe, expect, it } from "vitest";
import { activeLineIndex, groupConcurrentLines, parseLrc } from "./lrc";
import { artistMatchRatio, stringSimilarity } from "./match";

describe("parseLrc", () => {
	it("parses timed lines and durations", () => {
		const lrc = `
[ti:Test]
[00:01.00]Hello
[00:03.50]World
`;
		const lines = parseLrc(lrc);
		expect(lines[0]).toMatchObject({ timeMs: 0, text: "" });
		expect(lines[1]).toMatchObject({ timeMs: 1000, text: "Hello" });
		expect(lines[1].durationMs).toBe(2500);
		expect(lines[2]).toMatchObject({ timeMs: 3500, text: "World" });
	});

	it("applies offset tag", () => {
		const lines = parseLrc(`[offset:500]\n[00:01.00]Hi`);
		expect(lines.some((l) => l.text === "Hi" && l.timeMs === 1500)).toBe(true);
	});

	it("groups near-simultaneous duet lines", () => {
		const lines = parseLrc(`
[00:01.00]Voice one
[00:01.12]Voice two
[00:04.00]Together later
`);
		const duet = lines.find((l) => l.parts?.length === 2);
		expect(duet).toMatchObject({
			timeMs: 1000,
			text: "Voice one\nVoice two",
			parts: ["Voice one", "Voice two"],
		});
		expect(duet?.durationMs).toBe(3000);
		expect(lines.some((l) => l.text === "Together later")).toBe(true);
	});
});

describe("groupConcurrentLines", () => {
	it("merges chain of close starts", () => {
		const grouped = groupConcurrentLines([
			{ timeMs: 0, text: "A", durationMs: 100 },
			{ timeMs: 100, text: "B", durationMs: 100 },
			{ timeMs: 200, text: "C", durationMs: 2800 },
			{ timeMs: 3000, text: "D", durationMs: Infinity },
		]);
		expect(grouped).toHaveLength(2);
		expect(grouped[0].parts).toEqual(["A", "B", "C"]);
		expect(grouped[0].durationMs).toBe(3000);
		expect(grouped[1].text).toBe("D");
	});

	it("keeps far-apart lines separate", () => {
		const grouped = groupConcurrentLines([
			{ timeMs: 0, text: "A", durationMs: 2000 },
			{ timeMs: 2000, text: "B", durationMs: Infinity },
		]);
		expect(grouped).toHaveLength(2);
		expect(grouped[0].parts).toBeUndefined();
	});
});

describe("activeLineIndex", () => {
	it("picks current line", () => {
		const lines = parseLrc(`[00:00.00]A\n[00:02.00]B\n[00:04.00]C`);
		expect(activeLineIndex(lines, 0)).toBe(0);
		expect(activeLineIndex(lines, 2500)).toBe(1);
		expect(activeLineIndex(lines, 9000)).toBe(2);
	});

	it("binary-searches mid boundaries", () => {
		const lines = [
			{ timeMs: 0, text: "a", durationMs: 1000 },
			{ timeMs: 1000, text: "b", durationMs: 1000 },
			{ timeMs: 2000, text: "c", durationMs: 1000 },
			{ timeMs: 5000, text: "d", durationMs: Infinity },
		];
		expect(activeLineIndex(lines, 999)).toBe(0);
		expect(activeLineIndex(lines, 1000)).toBe(1);
		expect(activeLineIndex(lines, 1999)).toBe(1);
		expect(activeLineIndex(lines, 2000)).toBe(2);
		expect(activeLineIndex(lines, 4999)).toBe(2);
		expect(activeLineIndex(lines, 5000)).toBe(3);
	});
});

describe("match", () => {
	it("scores identical artists high", () => {
		expect(stringSimilarity("Radiohead", "Radiohead")).toBe(1);
		expect(artistMatchRatio("A & B", "B")).toBeGreaterThan(0.9);
	});
});
