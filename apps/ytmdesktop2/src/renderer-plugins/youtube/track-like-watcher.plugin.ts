import definePlugin from "@plugins/utils";
import IPC_EVENT_NAMES from "@shared/constants/eventNames";
import {
	publishLikeStatus,
	queryLikeRenderer,
	readLikeStatus,
	readPlayerVideoId,
	readRawLikeStatus,
} from "./ytm-like-status";

const POLL_MS = 200;
const MAX_WAIT_MS = 3_000;

export default definePlugin(
	"track-like-watcher",
	{
		enabled: true,
		displayName: "Track Like Watcher",
	},
	{
		exec({ api, log }) {
			let lastKey = "";
			let watchVideoId: string | null = null;
			let pollTimer: ReturnType<typeof setTimeout> | null = null;
			let attrObserver: MutationObserver | null = null;
			let observedEl: HTMLElement | null = null;

			const clearPoll = () => {
				if (pollTimer === null) return;
				clearTimeout(pollTimer);
				pollTimer = null;
			};

			const emitSettled = (videoId: string): boolean => {
				const status = readLikeStatus();
				if (!status.settled) return false;
				const key = `${videoId}|${Number(status.liked)}|${Number(status.disliked)}`;
				if (key === lastKey) return true;
				lastKey = key;
				const payload = { videoId, liked: status.liked, disliked: status.disliked };
				publishLikeStatus(payload);
				try {
					api.emit(IPC_EVENT_NAMES.TRACK_LIKE_STATE, payload);
				} catch (err) {
					log.error("Failed to emit track:like-state", err);
				}
				return true;
			};

			const onAttrChange = () => {
				const videoId = readPlayerVideoId() ?? watchVideoId;
				if (!videoId) return;
				emitSettled(videoId);
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

			const armPoll = (videoId: string) => {
				clearPoll();
				watchVideoId = videoId;
				const startedAt = Date.now();
				const baseline = readRawLikeStatus();
				bindAttrObserver();

				const tick = () => {
					if (watchVideoId !== videoId) return;
					bindAttrObserver();
					const activeId = readPlayerVideoId();
					if (activeId && activeId !== videoId) {
						clearPoll();
						return;
					}
					const raw = readRawLikeStatus();
					const mutated = raw !== "" && raw !== baseline;
					if ((mutated || Date.now() - startedAt >= MAX_WAIT_MS) && emitSettled(videoId)) {
						clearPoll();
						return;
					}
					if (Date.now() - startedAt >= MAX_WAIT_MS) {
						clearPoll();
						return;
					}
					pollTimer = setTimeout(tick, POLL_MS);
				};
				pollTimer = setTimeout(tick, POLL_MS);
			};

			const onTrackIdChange = (_ev: unknown, id: string) => {
				if (!id) return;
				lastKey = "";
				armPoll(id);
			};

			bindAttrObserver();
			window.ipcRenderer.on("trackId:change", onTrackIdChange);
			return () => {
				clearPoll();
				attrObserver?.disconnect();
				attrObserver = null;
				observedEl = null;
				window.ipcRenderer.off("trackId:change", onTrackIdChange);
			};
		},
	},
);
