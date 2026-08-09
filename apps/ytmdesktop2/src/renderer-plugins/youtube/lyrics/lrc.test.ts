import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	activeLineIndex,
	activeWordIndex,
	canWordSync,
	groupConcurrentLines,
	hasEnhancedWordSync,
	parseEnhancedWords,
	parseLrc,
	resolveLineWords,
	synthesizeLineWords,
} from "./lrc";
import { artistMatchRatio, stringSimilarity } from "./match";

const fixtureDir = dirname(fileURLToPath(import.meta.url));

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
		expect(duet?.words).toBeUndefined();
		expect(lines.some((l) => l.text === "Together later")).toBe(true);
	});

	it("parses enhanced word timestamps", () => {
		const lines = parseLrc(`
[00:01.00]<00:01.00>Hello <00:01.50>world
[00:03.00]plain
`);
		const enhanced = lines.find((l) => l.text === "Hello world");
		expect(enhanced?.words).toEqual([
			{ timeMs: 1000, text: "Hello ", durationMs: 500 },
			{ timeMs: 1500, text: "world", durationMs: 1500 },
		]);
		expect(lines.find((l) => l.text === "plain")?.words).toBeUndefined();
	});

	it("applies offset to word times", () => {
		const lines = parseLrc(`[offset:200]\n[00:01.00]<00:01.00>Hi <00:01.40>there`);
		const line = lines.find((l) => l.words?.length);
		expect(line?.timeMs).toBe(1200);
		expect(line?.words?.[0].timeMs).toBe(1200);
		expect(line?.words?.[1].timeMs).toBe(1600);
	});

	it("parses enhanced fixture sample", () => {
		const raw = readFileSync(join(fixtureDir, "fixtures/enhanced-sample.lrc"), "utf8");
		const lines = parseLrc(raw);
		expect(hasEnhancedWordSync(lines)).toBe(true);
		expect(canWordSync(lines)).toBe(true);
		const first = lines.find((l) => l.words?.length);
		expect(first?.words?.[0].text.trim()).toBe("When");
		expect(first?.words?.length).toBeGreaterThan(5);
		const plain = lines.find((l) => l.text.includes("plain line"));
		expect(plain?.words).toBeUndefined();
		expect(resolveLineWords(plain!, true)?.length).toBeGreaterThan(1);
	});
});

describe("synthesizeLineWords", () => {
	it("estimates evenly across line duration", () => {
		const words = synthesizeLineWords({
			timeMs: 1000,
			text: "Hello bright world",
			durationMs: 3000,
		});
		expect(words).toHaveLength(3);
		expect(words?.[0]).toMatchObject({ timeMs: 1000, text: "Hello " });
		expect(words?.[1].timeMs).toBe(2000);
		expect(words?.[2].timeMs).toBe(3000);
	});

	it("skips single-token and duet rows", () => {
		expect(synthesizeLineWords({ timeMs: 0, text: "Alone", durationMs: 1000 })).toBeUndefined();
		expect(
			synthesizeLineWords({
				timeMs: 0,
				text: "A\nB",
				durationMs: 1000,
				parts: ["A", "B"],
			}),
		).toBeUndefined();
	});

	it("resolveLineWords prefers enhanced over synth", () => {
		const line = {
			timeMs: 0,
			text: "Hello world",
			durationMs: 1000,
			words: [
				{ timeMs: 0, text: "Hello ", durationMs: 400 },
				{ timeMs: 400, text: "world", durationMs: 600 },
			],
		};
		expect(resolveLineWords(line, true)).toBe(line.words);
		expect(resolveLineWords(line, false)).toBeUndefined();
	});
});

describe("parseEnhancedWords", () => {
	it("returns plain text without stamps", () => {
		expect(parseEnhancedWords("Hello world")).toEqual({ text: "Hello world" });
	});

	it("keeps spaces between word cues", () => {
		const parsed = parseEnhancedWords("<00:00.00>When <00:00.16>the");
		expect(parsed.text).toBe("When the");
		expect(parsed.words?.map((w) => w.text)).toEqual(["When ", "the"]);
	});
});

describe("activeWordIndex", () => {
	it("picks current word", () => {
		const words = [
			{ timeMs: 1000, text: "a", durationMs: 500 },
			{ timeMs: 1500, text: "b", durationMs: 500 },
			{ timeMs: 2000, text: "c", durationMs: Infinity },
		];
		expect(activeWordIndex(words, 999)).toBe(-1);
		expect(activeWordIndex(words, 1000)).toBe(0);
		expect(activeWordIndex(words, 1499)).toBe(0);
		expect(activeWordIndex(words, 1500)).toBe(1);
		expect(activeWordIndex(words, 2500)).toBe(2);
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
