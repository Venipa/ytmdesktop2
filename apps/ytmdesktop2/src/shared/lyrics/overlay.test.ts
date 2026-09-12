import { describe, expect, it } from "vitest";
import {
	DEFAULT_LYRICS_OVERLAY_SETTINGS,
	joinHexColor,
	readLyricsOverlaySettings,
	resolveLyricsOverlayTimeMs,
	splitHexColor,
} from "./overlay";

describe("readLyricsOverlaySettings", () => {
	it("returns defaults for missing / garbage input", () => {
		expect(readLyricsOverlaySettings(undefined)).toEqual(DEFAULT_LYRICS_OVERLAY_SETTINGS);
		expect(readLyricsOverlaySettings("nope")).toEqual(DEFAULT_LYRICS_OVERLAY_SETTINGS);
		expect(readLyricsOverlaySettings({ enabled: "yes", lineStyle: "rainbow", align: "middle" })).toEqual(DEFAULT_LYRICS_OVERLAY_SETTINGS);
	});

	it("clamps the font size and keeps it integral", () => {
		expect(readLyricsOverlaySettings({ fontSize: 3 }).fontSize).toBe(14);
		expect(readLyricsOverlaySettings({ fontSize: 500 }).fontSize).toBe(72);
		expect(readLyricsOverlaySettings({ fontSize: "24.6" }).fontSize).toBe(25);
		expect(readLyricsOverlaySettings({ fontSize: NaN }).fontSize).toBe(DEFAULT_LYRICS_OVERLAY_SETTINGS.fontSize);
	});

	it("only accepts safe colour literals (they land in a style attribute)", () => {
		expect(readLyricsOverlaySettings({ textColor: "#abc" }).textColor).toBe("#abc");
		expect(readLyricsOverlaySettings({ accentColor: "rgba(10, 20, 30, 0.5)" }).accentColor).toBe("rgba(10, 20, 30, 0.5)");
		expect(readLyricsOverlaySettings({ textColor: "url(javascript:alert(1))" }).textColor).toBe(DEFAULT_LYRICS_OVERLAY_SETTINGS.textColor);
		expect(readLyricsOverlaySettings({ textColor: "red; background: url(x)" }).textColor).toBe(DEFAULT_LYRICS_OVERLAY_SETTINGS.textColor);
	});

	it("passes valid overrides through", () => {
		expect(readLyricsOverlaySettings({ enabled: true, locked: true, lineStyle: "bar", align: "left", showNextLine: false })).toMatchObject({
			enabled: true,
			locked: true,
			lineStyle: "bar",
			align: "left",
			showNextLine: false,
		});
	});
});

describe("outline width", () => {
	it("clamps to the allowed range in half-pixel steps", () => {
		expect(readLyricsOverlaySettings({ outlineWidth: 0 }).outlineWidth).toBe(0.5);
		expect(readLyricsOverlaySettings({ outlineWidth: 9 }).outlineWidth).toBe(6);
		expect(readLyricsOverlaySettings({ outlineWidth: 1.3 }).outlineWidth).toBe(1.5);
		expect(readLyricsOverlaySettings({ outlineWidth: "abc" }).outlineWidth).toBe(DEFAULT_LYRICS_OVERLAY_SETTINGS.outlineWidth);
	});
});

describe("splitHexColor / joinHexColor", () => {
	it("round-trips #rrggbbaa and expands short forms", () => {
		expect(splitHexColor("#ffffffb8")).toEqual({ hex: "#ffffff", alpha: 0xb8 / 255 });
		expect(splitHexColor("#5AB4FF")).toEqual({ hex: "#5ab4ff", alpha: 1 });
		expect(splitHexColor("#08f")).toEqual({ hex: "#0088ff", alpha: 1 });
		expect(splitHexColor("#08f8")).toEqual({ hex: "#0088ff", alpha: 0x88 / 255 });
		expect(splitHexColor("garbage")).toEqual({ hex: "#000000", alpha: 1 });
	});

	it("joins back, dropping the alpha byte when opaque and clamping otherwise", () => {
		expect(joinHexColor("#5ab4ff", 1)).toBe("#5ab4ff");
		expect(joinHexColor("#5ab4ff", 0.45)).toBe("#5ab4ff73");
		expect(joinHexColor("#5ab4ff", 0)).toBe("#5ab4ff00");
		expect(joinHexColor("#5ab4ff", 7)).toBe("#5ab4ff");
		expect(joinHexColor("#5ab4ffaa", NaN)).toBe("#5ab4ff");
		const { hex, alpha } = splitHexColor("#00000047");
		expect(joinHexColor(hex, alpha)).toBe("#00000047");
	});
});

describe("resolveLyricsOverlayTimeMs", () => {
	it("extrapolates while playing and freezes while paused", () => {
		expect(resolveLyricsOverlayTimeMs({ timeMs: 10_000, playing: true, at: 1_000 }, 1_250)).toBe(10_250);
		expect(resolveLyricsOverlayTimeMs({ timeMs: 10_000, playing: false, at: 1_000 }, 5_000)).toBe(10_000);
	});

	it("never runs backwards on clock skew and tolerates a missing packet", () => {
		expect(resolveLyricsOverlayTimeMs({ timeMs: 10_000, playing: true, at: 2_000 }, 1_000)).toBe(10_000);
		expect(resolveLyricsOverlayTimeMs(null, 1_000)).toBe(0);
	});
});
