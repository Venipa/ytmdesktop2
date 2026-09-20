import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lrcLibTitleVariants, pickBest, rankLrcLibHits, searchLrcLib } from "./lrclib";

const baseHit = {
	id: 1,
	trackName: "Test",
	artistName: "Artist",
	albumName: "Album",
	duration: 200,
	instrumental: false,
	plainLyrics: "hello",
	syncedLyrics: "[00:01.00] hello",
};

const info = {
	videoId: "x",
	title: "Test",
	artist: "Artist",
	durationSec: 200,
};

describe("pickBest / rankLrcLibHits", () => {
	it("prefers closer duration", () => {
		const close = { ...baseHit, id: 1, duration: 200 };
		const far = { ...baseHit, id: 2, duration: 230 };
		expect(pickBest([far, close], info, true)?.hit.id).toBe(1);
		expect(rankLrcLibHits([far, close], info)[0].hit.id).toBe(1);
	});

	it("marks inexact when outside tolerance", () => {
		const far = { ...baseHit, duration: 250 };
		const picked = pickBest([far], { ...info, durationSec: 200 }, true);
		expect(picked).toMatchObject({ inexact: true, hit: { duration: 250 } });
		expect(pickBest([far], info, false)).toBeNull();
	});
});

describe("searchLrcLib sync level", () => {
	const fetchMock = vi.fn<typeof fetch>();
	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const respond = (syncedLyrics: string) =>
		fetchMock.mockImplementation(
			async () =>
				new Response(JSON.stringify([{ ...baseHit, syncedLyrics }]), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		);

	it("stays line-level for plain LRC", async () => {
		respond("[00:01.00] hello\n[00:02.00] world");
		const result = await searchLrcLib(info, { showEvenIfInexact: true });
		expect(result).toMatchObject({ provider: "lrclib", syncLevel: "line", hasWordSync: false });
	});

	it("exposes word sync when LRCLib returns enhanced LRC", async () => {
		respond("[00:01.00] <00:01.00>hello <00:01.50>big <00:01.80>world\n[00:02.00] plain");
		const result = await searchLrcLib(info, { showEvenIfInexact: true });
		expect(result).toMatchObject({ syncLevel: "word", hasWordSync: true });
		const worded = result?.lines?.find((l) => l.words?.length);
		expect(worded?.words?.map((w) => w.text.trim())).toEqual(["hello", "big", "world"]);
	});
});

describe("lrcLibTitleVariants", () => {
	it("splits `原題 - romaji (english)` titles into queryable parts", () => {
		expect(lrcLibTitleVariants("真っ白 - masshiro (pure white)")).toEqual([
			"真っ白 - masshiro (pure white)",
			"真っ白",
			"masshiro (pure white)",
			"masshiro",
			"真っ白 - masshiro",
		]);
	});

	it("strips feat. and bracket suffixes, keeps plain titles as-is", () => {
		expect(lrcLibTitleVariants("Shape of You")).toEqual(["Shape of You"]);
		expect(lrcLibTitleVariants("Song [Remastered 2011] feat. Someone")).toEqual([
			"Song [Remastered 2011] feat. Someone",
			"Song [Remastered 2011]",
		]);
	});
});

describe("rankLrcLibHits sync preference", () => {
	it("prefers a synced hit over a closer plain-only hit within tolerance", () => {
		const plainClose = { ...baseHit, id: 1, duration: 200, syncedLyrics: null };
		const syncedFar = { ...baseHit, id: 2, duration: 205, syncedLyrics: "[00:01.00] a" };
		expect(rankLrcLibHits([plainClose, syncedFar], info)[0].hit.id).toBe(2);
	});

	it("still keeps out-of-tolerance synced hits behind in-tolerance plain hits", () => {
		const plainClose = { ...baseHit, id: 1, duration: 200, syncedLyrics: null };
		const syncedWayOff = { ...baseHit, id: 2, duration: 260, syncedLyrics: "[00:01.00] a" };
		expect(rankLrcLibHits([plainClose, syncedWayOff], info)[0].hit.id).toBe(1);
	});
});

describe("searchLrcLib title variants", () => {
	const fetchMock = vi.fn<typeof fetch>();
	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const kaze = { videoId: "k", title: "真っ白 - masshiro (pure white)", artist: "Fujii Kaze", durationSec: 297 };
	const hit = (id: number, trackName: string, duration: number, synced: boolean) => ({
		id,
		trackName,
		artistName: "Fujii Kaze",
		albumName: "Prema",
		duration,
		instrumental: false,
		plainLyrics: "plain",
		syncedLyrics: synced ? "[00:01.00] line" : null,
	});

	it("keeps querying variants until a synced in-tolerance hit appears, then picks it", async () => {
		// Mirrors real LRCLib responses: full title → plain-only (+ a short acapella), "masshiro" → synced.
		fetchMock.mockImplementation(async (input) => {
			const url = new URL(String(input instanceof Request ? input.url : input));
			const track = url.searchParams.get("track_name");
			const body =
				track === kaze.title
					? [hit(1, kaze.title, 295, false), hit(2, `${kaze.title} (Acapella)`, 272, true)]
					: track === "masshiro"
						? [hit(3, "masshiro", 294, false), hit(4, "masshiro (pure white)", 294, true)]
						: [];
			return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
		});

		const result = await searchLrcLib(kaze, { showEvenIfInexact: true });
		expect(result).toMatchObject({ title: "masshiro (pure white)", syncLevel: "line", inexact: false });
		const queried = fetchMock.mock.calls.map((c) => new URL(String(c[0] instanceof Request ? c[0].url : c[0])).searchParams.get("track_name"));
		expect(queried).toEqual([kaze.title, "真っ白", "masshiro (pure white)", "masshiro"]);
	});

	it("stops after the first query when it already has a synced hit", async () => {
		fetchMock.mockImplementation(
			async () => new Response(JSON.stringify([hit(9, kaze.title, 296, true)]), { status: 200, headers: { "content-type": "application/json" } }),
		);
		await searchLrcLib(kaze, { showEvenIfInexact: true });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
