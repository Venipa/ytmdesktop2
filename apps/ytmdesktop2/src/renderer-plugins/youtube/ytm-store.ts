export type YtmLikeStatusCode = "LIKE" | "DISLIKE" | "INDIFFERENT";

/** Minimal YTM redux store shape used by queue / like cmds. */
export type YtmStoreLike = {
	getState: () => {
		queue?: {
			items?: unknown[];
			nextQueueItemId?: number;
			shuffleEnabled?: boolean;
			repeatMode?: string;
			queueContextParams?: string;
		};
		likeStatus?: {
			videos?: Record<string, YtmLikeStatusCode | string>;
			playlists?: Record<string, YtmLikeStatusCode | string>;
		};
		playerPage?: {
			playerPageWatchNextResponse?: unknown;
		};
	};
	dispatch: (action: unknown) => void;
	subscribe?: (listener: () => void) => () => void;
};

export type YtmAppNetwork = {
	networkManager?: {
		fetch: (
			path: string,
			body: Record<string, unknown>,
		) => Promise<{ queueDatas?: { content?: unknown }[]; [key: string]: unknown }>;
	};
};

export type YtmQueueHost = {
	queue?: {
		continuation?: string;
		store?: { store?: unknown };
	};
};

type YtmdHookWindow = Window & { __YTMD_HOOK__?: { ytmStore?: YtmStoreLike; ytmPlayerBar?: { playerApi?: unknown } } };

export function isYtmStore(value: unknown): value is YtmStoreLike {
	if (!value || typeof value !== "object") return false;
	const store = value as Record<string, unknown>;
	return typeof store.getState === "function" && typeof store.dispatch === "function";
}

/** Cache on preload window (isolated). Page bag synced separately via agent script. */
export function cacheYtmStore(store: YtmStoreLike): void {
	const win = window as YtmdHookWindow;
	if (isYtmStore(win.__YTMD_HOOK__?.ytmStore)) return;
	win.__YTMD_HOOK__ = { ...win.__YTMD_HOOK__, ytmStore: store };
}

export function resolveQueueHost(): YtmQueueHost | null {
	return document.querySelector("#queue") as YtmQueueHost | null;
}

export function readQueueContinuation(): string {
	const token = resolveQueueHost()?.queue?.continuation;
	return typeof token === "string" ? token : "";
}

export function writeQueueContinuation(token: string): void {
	const queue = resolveQueueHost()?.queue;
	if (!queue) return;
	queue.continuation = token;
}

function readQueueHostStore(): YtmStoreLike | null {
	const store = resolveQueueHost()?.queue?.store?.store;
	return isYtmStore(store) ? store : null;
}

function readDomElementStore(): YtmStoreLike | null {
	const selectors = ["ytmusic-app", "ytmusic-app-layout>ytmusic-player-bar", "ytmusic-player-bar"] as const;
	for (const selector of selectors) {
		const store = (document.querySelector(selector) as { store?: unknown } | null)?.store;
		if (isYtmStore(store)) return store;
	}
	return null;
}

/** Prefer hooked store, then `#queue`, then app/player-bar. */
export function resolveYtmStore(): YtmStoreLike | null {
	const win = window as YtmdHookWindow;
	const hooked = win.__YTMD_HOOK__?.ytmStore;
	if (isYtmStore(hooked)) return hooked;

	const store = readQueueHostStore() ?? readDomElementStore();
	if (store) cacheYtmStore(store);
	return store;
}

export function resolveYtmApp(): YtmAppNetwork | null {
	return document.querySelector("ytmusic-app") as YtmAppNetwork | null;
}

export function dispatchQueueAddItems(store: YtmStoreLike, items: unknown[], index: number): void {
	if (!items.length) return;
	const queue = store.getState()?.queue;
	store.dispatch({
		type: "ADD_ITEMS",
		payload: {
			nextQueueItemId: queue?.nextQueueItemId,
			index,
			items,
			shuffleEnabled: queue?.shuffleEnabled ?? false,
			shouldAssignIds: true,
		},
	});
}
