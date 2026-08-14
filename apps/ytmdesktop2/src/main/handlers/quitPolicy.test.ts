import { describe, expect, it } from "vitest";
import { shouldCancelWindowClose } from "./quitPolicy";

describe("shouldCancelWindowClose", () => {
	it("cancels close when idle so hide-to-tray or cleanup can run", () => {
		expect(shouldCancelWindowClose({ quitting: false, hideToTray: true })).toBe(true);
	});

	it("does not cancel close once quitting", () => {
		expect(shouldCancelWindowClose({ quitting: true })).toBe(false);
		expect(shouldCancelWindowClose({ quitting: true, hideToTray: true })).toBe(false);
	});
});
