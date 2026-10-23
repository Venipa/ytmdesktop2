import type { PlayerApi } from "ytm-client-api";
import { parseNextPanel, QUEUE_CONTINUE_REMAINING, queueItemHitsVideoId, remainingAfterIndex } from "./queue-continue.parse";
import { getPagePlayerApi } from "./world0/context";
import type { RendererPluginRegistration } from "./world0/types";
import {
	appendQueueItems,
	readQueueContinuation,
	resolveYtmApp,
	resolveYtmStore,
	writeQueueContinuation,
} from "./ytm-store";

const SETTING_KEY = "player.queueContinue";

type PlayerEvents = {
	addEventListener?: (event: string, handler: () => void) => void;
	removeEventListener?: (event: string, handler: () => void) => void;
};

let enabled = true;

function readSetting(value: unknown): boolean {
	return value !== false;
}

function readVideoId(player: PlayerApi | null): string {
	if (!player) return "";
	try {
		const id = (player.getPlayerResponse?.() as { videoDetails?: { videoId?: string } } | undefined)?.videoDetails?.videoId;
		if (typeof id === "string" && id) return id;
	} catch {
		/* ignore */
	}
	try {
		const id = (player.getVideoData?.() as { video_id?: string } | undefined)?.video_id;
		if (typeof id === "string" && id) return id;
	} catch {
		/* ignore */
	}
	return "";
}

function currentIndex(player: PlayerApi | null, items: unknown[]): number {
	const videoId = readVideoId(player);
	if (!videoId) return -1;
	for (let i = items.length - 1; i >= 0; i--) {
		if (queueItemHitsVideoId(items[i], videoId)) return i;
	}
	return -1;
}

function playlistIdOf(player: PlayerApi | null): string {
	try {
		const id = player?.getPlaylistId?.();
		return typeof id === "string" ? id : "";
	} catch {
		return "";
	}
}

const queueContinueRenderer: RendererPluginRegistration = {
	id: "queue-continue",
	enabled: true,
	async start(ctx) {
		try {
			enabled = readSetting(await ctx.ytmd?.settings.get(SETTING_KEY));
		} catch {
			enabled = true;
		}
		return ctx.ytmd?.on("settingsProvider.change", (key, value) => {
			if (key === SETTING_KEY) {
				enabled = readSetting(value);
				return;
			}
			if (key === "player" && value && typeof value === "object" && "queueContinue" in (value as object)) {
				enabled = readSetting((value as { queueContinue?: boolean }).queueContinue);
			}
		});
	},
	onPlayerApiReady(playerApi, ctx) {
		let inFlight = false;
		let fetchedToken = "";
		let unsub: (() => void) | undefined;

		const tick = () => {
			if (!enabled || inFlight) return;
			unsub ??= resolveYtmStore()?.subscribe?.(tick);
			const token = readQueueContinuation();
			if (!token || token === fetchedToken) return;
			const store = resolveYtmStore();
			const items = store?.getState()?.queue?.items ?? [];
			const player = getPagePlayerApi() ?? playerApi;
			const index = currentIndex(player, items);
			const left = remainingAfterIndex(items.length, index);
			if (left < 0 || left > QUEUE_CONTINUE_REMAINING) return;
			const fetchFn = resolveYtmApp()?.networkManager?.fetch;
			if (!fetchFn) return;

			const body: Record<string, unknown> = { continuation: token };
			const playlistId = playlistIdOf(player);
			if (playlistId) body.playlistId = playlistId;
			if (index >= 0) body.index = index;

			inFlight = true;
			void fetchFn("/next", body)
				.then((res) => {
					const parsed = parseNextPanel(res);
					if (!parsed) {
						ctx.log.warn("queue continuation: empty /next panel");
						return;
					}
					appendQueueItems(parsed.items);
					writeQueueContinuation(parsed.continuation);
					fetchedToken = token;
				})
				.catch((err) => ctx.log.warn("queue continuation fetch failed", err))
				.finally(() => {
					inFlight = false;
				});
		};

		const player = playerApi as PlayerApi & PlayerEvents;
		player.addEventListener?.("onStateChange", tick);
		player.addEventListener?.("onVideoDataChange", tick);
		tick();
		window.addEventListener(
			"beforeunload",
			() => {
				unsub?.();
				player.removeEventListener?.("onStateChange", tick);
				player.removeEventListener?.("onVideoDataChange", tick);
			},
			{ once: true },
		);
	},
};

export default queueContinueRenderer;
