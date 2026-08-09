import { trackControls } from "./api-controls.cmds";
import {
	publishLikeStatus,
	queryLikeRenderer,
	readLikeStatus,
	readRawLikeStatus,
} from "./ytm-like-status";
import { getPagePlayerApi } from "./world0/context";
import type { RendererPluginRegistration } from "./world0/types";

const POLL_MS = 200;
const MAX_WAIT_MS = 3_000;
const SKIP_DISLIKED_KEY = "player.skipDisliked";

/**
 * Like/dislike watch + emit in page world.
 * Skip-disliked uses page playerApi directly (no preload bridge hop).
 */
const trackLikeRenderer: RendererPluginRegistration = {
	id: "track-like",
	enabled: true,
	async start(ctx) {
		let lastKey = "";
		let watchVideoId: string | null = null;
		let baseline = "";
		let pollTimer: ReturnType<typeof setTimeout> | null = null;
		let attrObserver: MutationObserver | null = null;
		let observedEl: HTMLElement | null = null;
		let skipDoneFor: string | null = null;
		let skipDisliked = false;

		try {
			skipDisliked = (await ctx.ytmd?.settings.get(SKIP_DISLIKED_KEY)) === true;
		} catch {
			/* default off */
		}

		const clearPoll = () => {
			if (pollTimer === null) return;
			clearTimeout(pollTimer);
			pollTimer = null;
		};

		const readActiveVideoId = (): string | null => {
			try {
				const data = getPagePlayerApi()?.getVideoData?.() as { video_id?: string } | undefined;
				return data?.video_id ?? null;
			} catch {
				return null;
			}
		};

		const trySkipDisliked = (videoId: string, reason: string) => {
			if (!skipDisliked) return;
			if (skipDoneFor === videoId) return;
			const status = readLikeStatus();
			if (!status.settled || !status.disliked) return;
			ctx.log.debug("skip disliked track", videoId, reason);
			const player = getPagePlayerApi();
			if (!player) return;
			const activeId = readActiveVideoId();
			if (activeId && activeId !== videoId) return;
			if (skipDoneFor === videoId) return;
			skipDoneFor = videoId;
			try {
				trackControls.next(player);
			} catch (err) {
				ctx.log.error("skip disliked next failed", err);
			}
		};

		const emitSettled = (videoId: string): boolean => {
			const status = readLikeStatus();
			if (!status.settled) return false;
			const key = `${videoId}|${Number(status.liked)}|${Number(status.disliked)}`;
			if (key !== lastKey) {
				lastKey = key;
				const payload = { videoId, liked: status.liked, disliked: status.disliked };
				publishLikeStatus(payload);
				try {
					ctx.ytmd?.emit("track:like-state", payload);
				} catch (err) {
					ctx.log.error("Failed to emit track:like-state", err);
				}
			}
			trySkipDisliked(videoId, "settled");
			return true;
		};

		const statusReady = (): boolean => {
			const raw = readRawLikeStatus();
			if (raw === "") return false;
			return raw !== baseline;
		};

		const onAttrChange = () => {
			const videoId = readActiveVideoId() ?? watchVideoId;
			if (!videoId || videoId !== watchVideoId) return;
			if (!statusReady()) return;
			if (emitSettled(videoId)) clearPoll();
		};

		const bindAttrObserver = (): boolean => {
			const el = queryLikeRenderer();
			if (!el) return false;
			if (el === observedEl && attrObserver) return true;
			attrObserver?.disconnect();
			observedEl = el;
			attrObserver = new MutationObserver(onAttrChange);
			attrObserver.observe(el, { attributes: true, attributeFilter: ["like-status", "like_status"] });
			return true;
		};

		const armWatch = (videoId: string) => {
			clearPoll();
			watchVideoId = videoId;
			skipDoneFor = null;
			baseline = readRawLikeStatus();
			bindAttrObserver();

			const startedAt = Date.now();
			const tick = () => {
				if (watchVideoId !== videoId) return;
				bindAttrObserver();
				const activeId = readActiveVideoId();
				if (activeId && activeId !== videoId) {
					clearPoll();
					return;
				}

				const ready = statusReady();
				const timedOut = Date.now() - startedAt >= MAX_WAIT_MS;

				if (ready && emitSettled(videoId)) {
					clearPoll();
					return;
				}
				if (timedOut) {
					void emitSettled(videoId);
					clearPoll();
					return;
				}
				pollTimer = setTimeout(tick, POLL_MS);
			};
			pollTimer = setTimeout(tick, POLL_MS);
		};

		const onTrackIdChange = (id: unknown) => {
			if (!id || typeof id !== "string") return;
			lastKey = "";
			armWatch(id);
		};

		bindAttrObserver();
		const unsubTrack = ctx.ytmd?.on("trackId:change", onTrackIdChange);
		const unsubSettings = ctx.ytmd?.on("settingsProvider.change", (key, value) => {
			if (key === SKIP_DISLIKED_KEY) {
				skipDisliked = value === true;
				return;
			}
			if (key === "player" && value && typeof value === "object" && "skipDisliked" in (value as object)) {
				skipDisliked = (value as { skipDisliked?: boolean }).skipDisliked === true;
			}
		});

		return () => {
			clearPoll();
			attrObserver?.disconnect();
			attrObserver = null;
			observedEl = null;
			unsubTrack?.();
			unsubSettings?.();
		};
	},
};

export default trackLikeRenderer;
