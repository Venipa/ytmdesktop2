import { describe, expect, test } from "vitest";
import type { TrackData } from "./trackData";
import {
	decideLastFmSession,
	preferLastFmTrack,
	relatedIdsIntersect,
	relatedVideoIds,
	trackNeedsLastFmPush,
} from "./lastfmTrackSession";

function makeTrack(opts: {
	videoId: string;
	counterpartVideoId?: string | null;
	isAudioExclusive: boolean;
	title?: string;
	duration?: number;
	startedAt?: number;
}): TrackData {
	return {
		video: {
			videoId: opts.videoId,
			title: opts.title ?? "Track",
			lengthSeconds: String(opts.duration ?? 200),
			channelId: "ch",
			isOwnerViewing: false,
			isCrawlable: true,
			thumbnail: { thumbnails: [] },
			averageRating: 0,
			allowRatings: true,
			viewCount: "0",
			author: "Artist",
			isPrivate: false,
			isUnpluggedCorpus: false,
			musicVideoType: opts.isAudioExclusive ? "MUSIC_VIDEO_TYPE_ATV" : "MUSIC_VIDEO_TYPE_OMV",
			isLiveContent: false,
		},
		context: {} as TrackData["context"],
		meta: {
			isAudioExclusive: opts.isAudioExclusive,
			counterpartVideoId: opts.counterpartVideoId ?? null,
			startedAt: opts.startedAt ?? 1000,
			duration: opts.duration ?? 200,
		},
		music: opts.isAudioExclusive ? { album: "Album" } : undefined,
	};
}

const cloneTrack = <T>(v: T): T => structuredClone(v);

describe("lastfmTrackSession smoke — Song↔Video", () => {
	const songId = "SONG1111111";
	const videoId = "VIDEO222222";

	test("related ids include counterpart pair", () => {
		const song = makeTrack({ videoId: songId, counterpartVideoId: videoId, isAudioExclusive: true });
		const video = makeTrack({ videoId, counterpartVideoId: songId, isAudioExclusive: false });
		expect(relatedVideoIds(song).sort()).toEqual([songId, videoId].sort());
		expect(relatedIdsIntersect(song, video)).toBe(true);
	});

	test("song-only: new session prefers song", () => {
		const song = makeTrack({ videoId: songId, isAudioExclusive: true });
		const decision = decideLastFmSession({
			track: song,
			lastRelatedIds: new Set(),
			pending: null,
			findById: () => undefined,
			cloneTrack,
		});
		expect(decision.type).toBe("new-session");
		if (decision.type === "new-session") {
			expect(decision.preferred.video.videoId).toBe(songId);
			expect(decision.preferred.meta.isAudioExclusive).toBe(true);
		}
	});

	test("video-only no counterpart: new session uses video", () => {
		const video = makeTrack({ videoId, isAudioExclusive: false });
		const decision = decideLastFmSession({
			track: video,
			lastRelatedIds: new Set(),
			pending: null,
			findById: () => undefined,
			cloneTrack,
		});
		expect(decision.type).toBe("new-session");
		if (decision.type === "new-session") {
			expect(decision.preferred.video.videoId).toBe(videoId);
		}
	});

	test("song → video before threshold: same session keep (no second NP)", () => {
		const song = makeTrack({ videoId: songId, counterpartVideoId: videoId, isAudioExclusive: true, startedAt: 1000 });
		const video = makeTrack({ videoId, counterpartVideoId: songId, isAudioExclusive: false, startedAt: 1100 });
		const decision = decideLastFmSession({
			track: video,
			lastRelatedIds: new Set([songId, videoId]),
			pending: { track: song, relatedIds: new Set([songId, videoId]) },
			findById: () => undefined,
			cloneTrack,
		});
		expect(decision.type).toBe("same-session-keep");
	});

	test("video → song: upgrade NP to ATV once", () => {
		const song = makeTrack({ videoId: songId, counterpartVideoId: videoId, isAudioExclusive: true, startedAt: 1100 });
		const video = makeTrack({ videoId, counterpartVideoId: songId, isAudioExclusive: false, startedAt: 1000 });
		const decision = decideLastFmSession({
			track: song,
			lastRelatedIds: new Set([videoId, songId]),
			pending: { track: video, relatedIds: new Set([videoId, songId]) },
			findById: () => undefined,
			cloneTrack,
		});
		expect(decision.type).toBe("upgrade-atv");
		if (decision.type === "upgrade-atv") {
			expect(decision.preferred.video.videoId).toBe(songId);
			expect(decision.preferred.meta.isAudioExclusive).toBe(true);
		}
	});

	test("after scrobble settled, toggle video: no new session", () => {
		const video = makeTrack({ videoId, counterpartVideoId: songId, isAudioExclusive: false });
		const decision = decideLastFmSession({
			track: video,
			lastRelatedIds: new Set([songId, videoId]),
			pending: null,
			findById: () => undefined,
			cloneTrack,
		});
		expect(decision.type).toBe("same-session-settled");
	});

	test("different track: new session (not stuck to counterpart set)", () => {
		const other = makeTrack({ videoId: "OTHER333333", isAudioExclusive: true });
		const decision = decideLastFmSession({
			track: other,
			lastRelatedIds: new Set([songId, videoId]),
			pending: {
				track: makeTrack({ videoId: songId, counterpartVideoId: videoId, isAudioExclusive: true }),
				relatedIds: new Set([songId, videoId]),
			},
			findById: () => undefined,
			cloneTrack,
		});
		expect(decision.type).toBe("new-session");
		if (decision.type === "new-session") {
			expect(decision.preferred.video.videoId).toBe("OTHER333333");
		}
	});

	test("prefer cached ATV when playing video", () => {
		const song = makeTrack({ videoId: songId, counterpartVideoId: videoId, isAudioExclusive: true, startedAt: 50 });
		const video = makeTrack({ videoId, counterpartVideoId: songId, isAudioExclusive: false, startedAt: 2000 });
		const preferred = preferLastFmTrack(video, (id) => (id === songId ? song : undefined), cloneTrack);
		expect(preferred.video.videoId).toBe(songId);
		expect(preferred.meta.startedAt).toBe(2000);
		expect(preferred.meta.counterpartVideoId).toBe(videoId);
	});

	test("needsLastFm: counterpart-only switch after ATV pending → false", () => {
		const song = makeTrack({ videoId: songId, counterpartVideoId: videoId, isAudioExclusive: true });
		const video = makeTrack({ videoId, counterpartVideoId: songId, isAudioExclusive: false });
		expect(
			trackNeedsLastFmPush({
				track: video,
				lastRelatedIds: new Set([songId, videoId]),
				pending: { track: song },
				findById: () => undefined,
				cloneTrack,
			}),
		).toBe(false);
	});

	test("needsLastFm: late counterpart id merge → true", () => {
		const song = makeTrack({ videoId: songId, counterpartVideoId: videoId, isAudioExclusive: true });
		expect(
			trackNeedsLastFmPush({
				track: song,
				lastRelatedIds: new Set([songId]),
				pending: { track: song },
				findById: () => undefined,
				cloneTrack,
			}),
		).toBe(true);
	});
});
