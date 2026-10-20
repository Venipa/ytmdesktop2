import { describe, expect, it } from "vitest";
import { parseLocalState, serializeLocalState } from "./use-local-state";

describe("local state envelope", () => {
	it("round-trips a boolean", () => {
		expect(parseLocalState(serializeLocalState(true), false)).toBe(true);
		expect(parseLocalState(serializeLocalState(false), true)).toBe(false);
	});

	it("falls back on junk or version mismatch", () => {
		expect(parseLocalState("nope", false)).toBe(false);
		expect(parseLocalState(JSON.stringify({ v: 99, value: true }), false)).toBe(false);
		expect(parseLocalState(null, true)).toBe(true);
	});
});
