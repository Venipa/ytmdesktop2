export type YtmLikeStatus = {
	liked: boolean;
	disliked: boolean;
	/** Attribute or aria buttons present — status is trustworthy. */
	settled: boolean;
};

export type YtmLikeStatePayload = {
	videoId: string;
	liked: boolean;
	disliked: boolean;
};

const LIKE_RENDERER_SEL = "#like-button-renderer, ytmusic-like-button-renderer";

type LikeListener = (payload: YtmLikeStatePayload) => void;
const likeListeners = new Set<LikeListener>();

export function queryLikeRenderer(): HTMLElement | null {
	return document.querySelector<HTMLElement>(LIKE_RENDERER_SEL);
}

export function readRawLikeStatus(el: HTMLElement | null = queryLikeRenderer()): string {
	return (el?.getAttribute("like-status") || el?.getAttribute("like_status") || "").toUpperCase();
}

/** Prefer like-status attr; fall back to aria-pressed on like/dislike buttons. */
export function readLikeStatus(): YtmLikeStatus {
	const el = queryLikeRenderer();
	const status = readRawLikeStatus(el);
	if (status === "LIKE" || status === "DISLIKE" || status === "INDIFFERENT") {
		return { liked: status === "LIKE", disliked: status === "DISLIKE", settled: true };
	}
	const likeBtn = document.querySelector<HTMLElement>("#like-button-renderer #button-shape-like.like button");
	const dislikeBtn = document.querySelector<HTMLElement>("#like-button-renderer #button-shape-dislike.dislike button");
	if (!likeBtn || !dislikeBtn) {
		return { liked: false, disliked: false, settled: false };
	}
	return {
		liked: likeBtn.getAttribute("aria-pressed") === "true",
		disliked: dislikeBtn.getAttribute("aria-pressed") === "true",
		settled: true,
	};
}

export function readPlayerVideoId(): string | null {
	try {
		const data = window.domUtils?.playerApi?.()?.getVideoData?.() as { video_id?: string } | undefined;
		return data?.video_id ?? null;
	} catch {
		return null;
	}
}

/** In-page fans (skip-disliked, etc.) — not IPC. */
export function onLikeStatusSettled(listener: LikeListener): () => void {
	likeListeners.add(listener);
	return () => likeListeners.delete(listener);
}

export function publishLikeStatus(payload: YtmLikeStatePayload): void {
	for (const listener of likeListeners) {
		try {
			listener(payload);
		} catch {
			/* listener errors must not break publisher */
		}
	}
}
