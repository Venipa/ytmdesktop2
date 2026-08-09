import definePlugin from "@plugins/utils";
import IPC_EVENT_NAMES from "@shared/constants/eventNames";
import { requestApiControl } from "./api-controls.page";
import {
	publishLikeStatus,
	queryLikeRenderer,
	readLikeStatus,
	readPlayerVideoId,
	readRawLikeStatus,
} from "./ytm-like-status";

const POLL_MS = 200;
const MAX_WAIT_MS = 3_000;

/**
 * Like/dislike state emit + optional skip-disliked.
 * One observer + one poll per track id.
 */
export default definePlugin(
	"track-like",
	{
		enabled: true,
		displayName: "Track like",
	},
	{
		exec({ api, log, ytmd, settings }) {
			let lastKey = "";
			let watchVideoId: string | null = null;
			let baseline = "";
			let pollTimer: ReturnType<typeof setTimeout> | null = null;
			let attrObserver: MutationObserver | null = null;
			let observedEl: HTMLElement | null = null;
			let skipDoneFor: string | null = null;

			const clearPoll = () => {
				if (pollTimer === null) return;
				clearTimeout(pollTimer);
				pollTimer = null;
			};

			const trySkipDisliked = (videoId: string, reason: string) => {
				if (!settings.player?.skipDisliked) return;
				if (skipDoneFor === videoId) return;
				const status = readLikeStatus();
				if (!status.settled || !status.disliked) return;
				log.debug("skip disliked track", videoId, reason);
				void (async () => {
					const activeId = (await requestApiControl<string | null>("videoId").catch(() => null)) ?? null;
					if (activeId && activeId !== videoId) return;
					if (skipDoneFor === videoId) return;
					skipDoneFor = videoId;
					try {
						await requestApiControl("next");
					} catch (err) {
						log.error("skip disliked next failed", err);
					}
				})();
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
						api.emit(IPC_EVENT_NAMES.TRACK_LIKE_STATE, payload);
					} catch (err) {
						log.error("Failed to emit track:like-state", err);
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
				const videoId = readPlayerVideoId() ?? watchVideoId;
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
					const activeId = readPlayerVideoId();
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
						// Unchanged baseline across consecutive disliked tracks still counts.
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
			const unsubTrack =
				ytmd && "onInternal" in ytmd && typeof ytmd.onInternal === "function"
					? ytmd.onInternal("trackId:change", onTrackIdChange)
					: ytmd?.on("trackId:change", onTrackIdChange);
			return () => {
				clearPoll();
				attrObserver?.disconnect();
				attrObserver = null;
				observedEl = null;
				unsubTrack?.();
			};
		},
	},
);
