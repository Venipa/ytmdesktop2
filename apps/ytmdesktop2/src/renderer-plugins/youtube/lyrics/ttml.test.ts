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
});
