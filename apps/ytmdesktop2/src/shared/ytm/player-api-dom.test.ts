import { describe, expect, it } from "vitest";
import { isYtmPlayerApiReady } from "./player-api-dom";

describe("isYtmPlayerApiReady", () => {
	it("uses isReady() when present", () => {
		expect(isYtmPlayerApiReady({ isReady: () => true })).toBe(true);
		expect(isYtmPlayerApiReady({ isReady: () => false })).toBe(false);
	});

	it("accepts movie_player fingerprint without isReady", () => {
		expect(
			isYtmPlayerApiReady({
				playVideo: () => {},
				getPlayerState: () => 2,
			}),
		).toBe(true);
		expect(isYtmPlayerApiReady({ playVideo: () => {} })).toBe(false);
	});
});
