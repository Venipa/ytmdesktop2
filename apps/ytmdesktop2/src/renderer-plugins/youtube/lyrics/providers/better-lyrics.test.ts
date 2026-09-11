import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LyricsMissReason, TrackSearchInfo } from "../types";
import { searchBetterLyrics } from "./better-lyrics";

const info: TrackSearchInfo = {
	videoId: "dQw4w9WgXcQ",
	title: "Never Gonna Give You Up",
	artist: "Rick Astley",
	durationSec: 213,
};

const TTML = `<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="00:00:01.000" end="00:00:02.000">hi</p></div></body></tt>`;

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("searchBetterLyrics", () => {
	const fetchMock = vi.fn<typeof fetch>();

	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function lastRequestHeaders(): Headers {
		const [input, init] = fetchMock.mock.calls.at(-1) ?? [];
		if (input instanceof Request) return input.headers;
		return new Headers(init?.headers);
	}

	it("sends X-API-Key only when a key is set", async () => {
		fetchMock.mockImplementation(async () => jsonResponse(200, { ttml: TTML }));

		await searchBetterLyrics(info);
		expect(lastRequestHeaders().get("x-api-key")).toBeNull();

		await searchBetterLyrics(info, { apiKey: "  secret  " });
		expect(lastRequestHeaders().get("x-api-key")).toBe("secret");
	});

	it("reports 401 as uncached without a key, invalid-key with one", async () => {
		fetchMock.mockImplementation(async () => jsonResponse(401, { error: "API key required" }));

		const reasons: LyricsMissReason[] = [];
		expect(await searchBetterLyrics(info, { onMiss: (r) => reasons.push(r) })).toBeNull();
		expect(await searchBetterLyrics(info, { apiKey: "bad", onMiss: (r) => reasons.push(r) })).toBeNull();
		expect(reasons).toEqual(["uncached", "invalid-key"]);
	});

	it("maps 404 / 429 to soft misses and throws on other errors", async () => {
		const reasons: LyricsMissReason[] = [];
		const onMiss = (r: LyricsMissReason) => reasons.push(r);

		fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: "not found" }));
		expect(await searchBetterLyrics(info, { onMiss })).toBeNull();
		fetchMock.mockResolvedValueOnce(jsonResponse(429, { error: "slow down" }));
		expect(await searchBetterLyrics(info, { onMiss })).toBeNull();
		expect(reasons).toEqual(["not-found", "rate-limited"]);

		fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: "boom" }));
		await expect(searchBetterLyrics(info, { onMiss })).rejects.toThrow("Better Lyrics HTTP 500");
		expect(reasons).toHaveLength(2);
	});
});
