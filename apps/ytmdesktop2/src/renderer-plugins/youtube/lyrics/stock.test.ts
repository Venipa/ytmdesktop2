import { describe, expect, it } from "vitest";
import { resolveLyricsDisplay } from "./stock";

describe("resolveLyricsDisplay", () => {
	it.each([
		[{ status: "ready", hasTimedLines: true, hasStock: true }, { mode: "overlay", status: null }],
		[{ status: "ready", hasTimedLines: false, hasStock: true }, { mode: "stock", status: "stock" }],
		[{ status: "ready", hasTimedLines: false, hasStock: false }, { mode: "overlay", status: null }],
		[{ status: "empty", hasTimedLines: false, hasStock: true }, { mode: "stock", status: "stock" }],
		[{ status: "loading", hasTimedLines: false, hasStock: true }, { mode: "overlay", status: null }],
	] as const)("%j → %j", (input, expected) => {
		expect(resolveLyricsDisplay(input)).toEqual(expected);
	});
});
