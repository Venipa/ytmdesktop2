import { trackControls } from "./api-controls.cmds";
import { readActiveVideoId, readLikeStatus } from "./ytm-like-status";
import { resolveYtmStore } from "./ytm-store";
import { getPagePlayerApi } from "./world0/context";
import type { RendererPluginRegistration } from "./world0/types";

const SKIP_DISLIKED_KEY = "player.skipDisliked";
const STORE_HOOK_MS = 250;
const STORE_HOOK_MAX_MS = 20_000;

/**
 * Like/dislike watch + emit from YTM redux store.
 * Skip-disliked uses page playerApi directly (no preload bridge hop).
 */
const trackLikeRenderer: RendererPluginRegistration = {
	id: "track-like",
	enabled: true,
	async start(ctx) {
		let lastKey = "";
		let watchVideoId: string | null = null;
		let skipDoneFor: string | null = null;
		let skipDisliked = false;
		let unsubStore: (() => void) | undefined;
		let hookTimer: ReturnType<typeof setInterval> | null = null;

		try {
			skipDisliked = (await ctx.ytmd?.settings.get(SKIP_DISLIKED_KEY)) === true;
		} catch {
			/* default off */
		}

		const trySkipDisliked = (videoId: string) => {
			if (!skipDisliked || skipDoneFor === videoId) return;
			const status = readLikeStatus(videoId);
			if (!status.settled || !status.disliked) return;
			const player = getPagePlayerApi();
			if (!player) return;
			const activeId = readActiveVideoId();
			if (activeId && activeId !== videoId) return;
			skipDoneFor = videoId;
			try {
				trackControls.next(player);
			} catch (err) {
				ctx.log.error("skip disliked next failed", err);
			}
		};

		const emitSettled = (videoId: string) => {
			const status = readLikeStatus(videoId);
			if (!status.settled) return;
			const key = `${videoId}|${Number(status.liked)}|${Number(status.disliked)}`;
			if (key !== lastKey) {
				lastKey = key;
				const payload = { videoId, liked: status.liked, disliked: status.disliked };
				try {
					ctx.ytmd?.emit("track:like-state", payload);
				} catch (err) {
					ctx.log.error("Failed to emit track:like-state", err);
				}
			}
			trySkipDisliked(videoId);
		};

		const sync = (id?: string | null) => {
			const videoId = id || readActiveVideoId() || watchVideoId;
			if (!videoId) return;
			if (videoId !== watchVideoId) {
				watchVideoId = videoId;
				lastKey = "";
				skipDoneFor = null;
			}
			emitSettled(videoId);
		};

		const bindStore = (): boolean => {
			if (unsubStore) return true;
			const store = resolveYtmStore();
			if (!store?.subscribe) return false;
			unsubStore = store.subscribe(() => sync());
			sync();
			return true;
		};

		if (!bindStore()) {
			const startedAt = Date.now();
			hookTimer = setInterval(() => {
				if (bindStore() || Date.now() - startedAt > STORE_HOOK_MAX_MS) {
					if (hookTimer) clearInterval(hookTimer);
					hookTimer = null;
				}
			}, STORE_HOOK_MS);
		}

		sync(readActiveVideoId());
		const unsubTrack = ctx.ytmd?.on("trackId:change", (id) => {
			if (typeof id === "string" && id) sync(id);
		});
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
			if (hookTimer) clearInterval(hookTimer);
			unsubStore?.();
			unsubTrack?.();
			unsubSettings?.();
		};
	},
};

export default trackLikeRenderer;
