import type { PlayerApi } from "ytm-client-api";
import { parseNextPanel, QUEUE_CONTINUE_REMAINING, queueItemVideoId, remainingAfterIndex } from "./queue-continue.parse";
import type { RendererPluginRegistration } from "./world0/types";
import {
	dispatchQueueAddItems,
	readQueueContinuation,
	resolveYtmApp,
	resolveYtmStore,
	writeQueueContinuation,
} from "./ytm-store";

type PlayerEvents = {
	addEventListener?: (event: string, handler: () => void) => void;
	removeEventListener?: (event: string, handler: () => void) => void;
};

function playlistIndex(player: PlayerApi, items: unknown[]): number {
	try {
		const idx = player.getPlaylistIndex?.();
		if (typeof idx === "number" && idx >= 0 && idx < items.length) return idx;
	} catch {
		/* fall through */
	}
	try {
		const id = (player.getPlayerResponse?.() as { videoDetails?: { videoId?: string } } | undefined)?.videoDetails
			?.videoId;
		if (typeof id === "string" && id) return items.findIndex((item) => queueItemVideoId(item) === id);
	} catch {
		/* ignore */
	}
	return -1;
}

const queueContinueRenderer: RendererPluginRegistration = {
	id: "queue-continue",
	enabled: true,
	onPlayerApiReady(playerApi, ctx) {
		let inFlight = false;
		let fetchedToken = "";
		let unsub: (() => void) | undefined;
		const player = playerApi as PlayerApi & PlayerEvents;

		const tick = () => {
			unsub ??= resolveYtmStore()?.subscribe?.(tick);
			if (inFlight) return;
			const token = readQueueContinuation();
			if (!token || token === fetchedToken) return;
			const store = resolveYtmStore();
			const items = store?.getState()?.queue?.items ?? [];
			const left = remainingAfterIndex(items.length, playlistIndex(playerApi, items));
			if (left < 0 || left > QUEUE_CONTINUE_REMAINING) return;
			const fetchFn = resolveYtmApp()?.networkManager?.fetch;
			if (!store || !fetchFn) return;

			inFlight = true;
			void fetchFn("/next", { continuation: token })
				.then((res) => {
					const parsed = parseNextPanel(res);
					if (!parsed) return;
					dispatchQueueAddItems(store, parsed.items, store.getState()?.queue?.items?.length ?? items.length);
					writeQueueContinuation(parsed.continuation);
					fetchedToken = token;
				})
				.catch((err) => ctx.log.warn("queue continuation fetch failed", err))
				.finally(() => {
					inFlight = false;
				});
		};

		player.addEventListener?.("onStateChange", tick);
		tick();
		window.addEventListener(
			"beforeunload",
			() => {
				unsub?.();
				player.removeEventListener?.("onStateChange", tick);
			},
			{ once: true },
		);
	},
};

export default queueContinueRenderer;
