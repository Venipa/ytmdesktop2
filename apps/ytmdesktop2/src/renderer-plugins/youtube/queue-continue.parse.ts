export const QUEUE_CONTINUE_REMAINING = 3;
const FIND_DEPTH = 16;

export type ParsedQueuePanel = {
	items: unknown[];
	continuation: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function findKey(root: unknown, keys: ReadonlySet<string>, depth: number): unknown {
	if (depth < 0 || root == null || typeof root !== "object") return undefined;
	if (Array.isArray(root)) {
		for (const item of root) {
			const found = findKey(item, keys, depth - 1);
			if (found !== undefined) return found;
		}
		return undefined;
	}
	const rec = root as Record<string, unknown>;
	for (const key of keys) {
		if (key in rec) return rec[key];
	}
	for (const value of Object.values(rec)) {
		const found = findKey(value, keys, depth - 1);
		if (found !== undefined) return found;
	}
	return undefined;
}

function continuationFromPanel(panel: Record<string, unknown>): string {
	if (!Array.isArray(panel.continuations)) return "";
	for (const entry of panel.continuations) {
		if (!isRecord(entry)) continue;
		const next = entry.nextContinuationData;
		if (isRecord(next) && typeof next.continuation === "string") return next.continuation;
	}
	return "";
}

/** Contents + next continuation from a `/next` watch-next payload. */
export function parseNextPanel(res: unknown): ParsedQueuePanel | null {
	const panel = findKey(res, new Set(["playlistPanelContinuation", "playlistPanelRenderer"]), FIND_DEPTH);
	if (!isRecord(panel) || !Array.isArray(panel.contents) || !panel.contents.length) return null;
	return { items: panel.contents, continuation: continuationFromPanel(panel) };
}

export function remainingAfterIndex(itemCount: number, currentIndex: number): number {
	if (itemCount <= 0 || currentIndex < 0 || currentIndex >= itemCount) return -1;
	return itemCount - currentIndex - 1;
}

export function queueItemVideoId(item: unknown): string | null {
	if (!isRecord(item)) return null;
	const renderer = isRecord(item.playlistPanelVideoRenderer)
		? item.playlistPanelVideoRenderer
		: item;
	if (typeof renderer.videoId === "string" && renderer.videoId) return renderer.videoId;
	const watch = isRecord(renderer.navigationEndpoint) ? renderer.navigationEndpoint.watchEndpoint : undefined;
	return isRecord(watch) && typeof watch.videoId === "string" ? watch.videoId : null;
}
