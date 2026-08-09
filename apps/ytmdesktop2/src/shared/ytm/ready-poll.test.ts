import { describe, expect, it } from "vitest";
import { buildYtmReadyPollScript } from "./ready-poll";

describe("buildYtmReadyPollScript", () => {
	it("embeds timeout and returns async iife", () => {
		const script = buildYtmReadyPollScript({ timeoutMs: 5000, requirePlayer: true, requireLoaded: false });
		expect(script.startsWith("(async () => {")).toBe(true);
		expect(script).toContain("Date.now() + 5000");
		expect(script).toContain("needLoaded = false");
		expect(script).toContain("needPlayer = true");
	});
});
