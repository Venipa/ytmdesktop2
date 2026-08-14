import { resolveYtmStore } from "./ytm-store";
import { getPagePlayerApi } from "./world0/context";

export type YtmLikeStatus = {
	liked: boolean;
	disliked: boolean;
	settled: boolean;
};

export type YtmLikeStatePayload = {
	videoId: string;
	liked: boolean;
	disliked: boolean;
};

export function readActiveVideoId(): string | null {
	try {
		const data = getPagePlayerApi()?.getVideoData?.() as { video_id?: string } | undefined;
		if (typeof data?.video_id === "string" && data.video_id) return data.video_id;
	} catch {
		/* ignore */
	}
	return null;
}

function statusFromCode(code: string | undefined): YtmLikeStatus | null {
	const status = (code || "").toUpperCase();
	if (status === "LIKE" || status === "DISLIKE" || status === "INDIFFERENT") {
		return { liked: status === "LIKE", disliked: status === "DISLIKE", settled: true };
	}
	return null;
}

function findLikeButtonForVideo(root: unknown, videoId: string, depth = 0, seen?: WeakSet<object>): YtmLikeStatus | null {
	if (!root || typeof root !== "object" || depth > 12) return null;
	const bag = seen ?? new WeakSet<object>();
	if (bag.has(root)) return null;
	bag.add(root);
	const rec = root as Record<string, unknown>;
	const renderer = rec.likeButtonRenderer;
	if (renderer && typeof renderer === "object") {
		const like = renderer as { likeStatus?: string; target?: { videoId?: string } };
		if (!like.target?.videoId || like.target.videoId === videoId) {
			const status = statusFromCode(like.likeStatus);
			if (status) return status;
		}
	}
	if (typeof rec.likeStatus === "string" && (rec.target as { videoId?: string } | undefined)?.videoId === videoId) {
		const status = statusFromCode(rec.likeStatus);
		if (status) return status;
	}
	for (const value of Object.values(rec)) {
		if (!value || typeof value !== "object") continue;
		const hit = findLikeButtonForVideo(value, videoId, depth + 1, bag);
		if (hit) return hit;
	}
	return null;
}

/** `likeStatus.videos[id]`, else watch-next on same store (cold start map empty). */
export function readLikeStatus(videoId: string | null = readActiveVideoId()): YtmLikeStatus {
	if (!videoId) return { liked: false, disliked: false, settled: false };
	const state = resolveYtmStore()?.getState?.();
	const stored = statusFromCode(state?.likeStatus?.videos?.[videoId]);
	if (stored) return stored;
	return findLikeButtonForVideo(state?.playerPage?.playerPageWatchNextResponse, videoId) ?? {
		liked: false,
		disliked: false,
		settled: false,
	};
}
