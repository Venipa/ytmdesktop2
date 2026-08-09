import { describe, expect, it } from "vitest";
import { moduleSourceToIife } from "./run-script";

describe("world0 run-script", () => {
	it("strips ESM exports into an IIFE", () => {
		const src = `export const foo = 1;\nexport function injectRm3() {}\nexport { foo };`;
		const out = moduleSourceToIife(src, "injectRm3();");
		expect(out).toContain("const foo = 1");
		expect(out).toContain("function injectRm3()");
		expect(out).not.toMatch(/\bexport\b/);
		expect(out).toContain("injectRm3();");
		expect(out.startsWith("(() => {")).toBe(true);
	});
});
