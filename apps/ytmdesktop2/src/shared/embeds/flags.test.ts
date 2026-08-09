import { describe, expect, it } from "vitest";
import { buildNowPlayingEmbedUrl, parseEmbedFlags, serializeEmbedFlags } from "./flags";

describe("embed flags", () => {
	it("parses defaults from empty query", () => {
		expect(parseEmbedFlags(new URLSearchParams())).toEqual({
			layout: "default",
			art: true,
			title: true,
			artist: true,
			progress: true,
			transparent: true,
			scale: 1,
		});
	});

	it("parses layout variants", () => {
		expect(parseEmbedFlags(new URLSearchParams("layout=compact")).layout).toBe("compact");
		expect(parseEmbedFlags(new URLSearchParams("layout=text")).layout).toBe("text");
		expect(parseEmbedFlags(new URLSearchParams("layout=badge")).layout).toBe("badge");
		expect(parseEmbedFlags(new URLSearchParams("layout=fullscreen")).layout).toBe("fullscreen");
		expect(parseEmbedFlags(new URLSearchParams("layout=stack")).layout).toBe("stack");
		expect(parseEmbedFlags(new URLSearchParams("layout=ticker")).layout).toBe("ticker");
		expect(parseEmbedFlags(new URLSearchParams("layout=nope")).layout).toBe("default");
	});

	it("serializes only non-defaults", () => {
		expect(serializeEmbedFlags({})).toBe("");
		expect(serializeEmbedFlags({ art: false, token: "abc" })).toBe("art=0&token=abc");
		expect(serializeEmbedFlags({ layout: "badge" })).toBe("layout=badge");
	});

	it("builds now-playing url", () => {
		expect(buildNowPlayingEmbedUrl("http://127.0.0.1:13091")).toBe(
			"http://127.0.0.1:13091/embed/now-playing",
		);
		expect(buildNowPlayingEmbedUrl("http://127.0.0.1:13091/", { progress: false })).toBe(
			"http://127.0.0.1:13091/embed/now-playing?progress=0",
		);
		expect(buildNowPlayingEmbedUrl("http://127.0.0.1:13091", { layout: "text" })).toBe(
			"http://127.0.0.1:13091/embed/now-playing?layout=text",
		);
	});
});
