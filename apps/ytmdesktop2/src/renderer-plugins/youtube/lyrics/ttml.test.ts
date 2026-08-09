import { describe, expect, it } from "vitest";
import { parseTtml, parseTtmlTime, ttmlHasWordSync } from "./ttml";

const SAMPLE = `<?xml version="1.0"?>
<tt itunes:timing="Word" xml:lang="en"
  xmlns="http://www.w3.org/ns/ttml"
  xmlns:itunes="http://music.apple.com/lyric-ttml-internal"
  xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <body>
    <div>
      <p begin="9.731" end="12.105" itunes:key="L1" ttm:agent="v1"><span begin="9.731" end="9.927">The</span> <span begin="9.927" end="10.284">club</span> <span begin="10.284" end="10.570">isn't</span></p>
      <p begin="15.000" end="18.000">line only</p>
    </div>
  </body>
</tt>`;

const NESTED_BG = `<p begin="5.616" end="7.385" itunes:key="L3" ttm:agent="v1"><span begin="5.616" end="6.059">Boba</span> <span begin="6.059" end="6.506">tea</span> <span ttm:role="x-bg"><span begin="6.576" end="7.385">(Gnarly)</span></span></p>`;

const SYLLABLE_JOIN = `<p begin="21.510" end="22.171"><span begin="21.510" end="21.744">gang-</span><span begin="21.744" end="22.171">gang</span></p>`;

describe("parseTtmlTime", () => {
	it("parses decimal seconds and mm:ss", () => {
		expect(parseTtmlTime("9.731")).toBe(9731);
		expect(parseTtmlTime("1:02.5")).toBe(62500);
		expect(parseTtmlTime("2.5s")).toBe(2500);
	});
});

describe("parseTtml", () => {
	it("extracts word spans and preserves spaces", () => {
		expect(ttmlHasWordSync(SAMPLE)).toBe(true);
		const lines = parseTtml(SAMPLE);
		const first = lines.find((l) => l.words?.length);
		expect(first?.timeMs).toBe(9731);
		expect(first?.durationMs).toBe(2374);
		expect(first?.words?.[0]).toMatchObject({ timeMs: 9731, text: "The ", durationMs: 196 });
		expect(first?.words?.[1].text.trim()).toBe("club");
		expect(first?.text).toContain("The club");

		const lineOnly = lines.find((l) => l.text === "line only");
		expect(lineOnly?.words).toBeUndefined();
		expect(lineOnly?.timeMs).toBe(15000);
	});

	it("flattens nested x-bg spans without leftover markup", () => {
		const lines = parseTtml(
			`<tt xmlns:ttm="http://music.apple.com/lyric-ttml-internal"><body>${NESTED_BG}</body></tt>`,
		);
		const line = lines.find((l) => l.text.includes("Boba"));
		expect(line?.text).toBe("Boba tea (Gnarly)");
		expect(line?.text).not.toMatch(/\/span>|<\/?span/i);
		expect(line?.words?.map((w) => w.text.trim())).toEqual(["Boba", "tea", "(Gnarly)"]);
	});

	it("joins syllable spans without injecting junk", () => {
		const lines = parseTtml(`<tt><body>${SYLLABLE_JOIN}</body></tt>`);
		const line = lines.find((l) => l.text.includes("gang"));
		expect(line?.text).toBe("gang-gang");
		expect(line?.text).not.toContain("/span>");
	});

	it("flattens multi-word x-bg without leftover /span>", () => {
		const html = `<p begin="14.600" end="17.149"><span begin="14.600" end="14.747">Oh</span> <span begin="14.747" end="14.899">my</span> <span begin="14.899" end="15.109">god,</span> <span begin="15.109" end="15.283">that</span> <span begin="15.283" end="15.515">new</span> <span begin="15.515" end="16.002">beat</span> <span ttm:role="x-bg"><span begin="15.432" end="16.157">(Fucking</span> <span begin="16.157" end="17.149">gnarly)</span></span></p>`;
		const lines = parseTtml(`<tt xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><body>${html}</body></tt>`);
		const line = lines.find((l) => l.text.includes("beat"));
		expect(line?.text).toBe("Oh my god, that new beat (Fucking gnarly)");
		expect(line?.text).not.toMatch(/\/span>|<\/?span/i);
	});
});
