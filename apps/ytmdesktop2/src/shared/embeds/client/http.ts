import { mapTrackToViewModel, withApiThumbnail } from "../map";
import type { EmbedStateLike, EmbedTrackLike, NowPlayingViewModel } from "../types";

export interface EmbedHttpClientOptions {
	readonly baseUrl: string;
	readonly token?: string | null;
	readonly onTrack: (track: NowPlayingViewModel | null) => void;
	readonly onStatus?: (status: string | null) => void;
}

function joinUrl(base: string, path: string, token?: string | null): string {
	const root = base.replace(/\/$/, "");
	const url = new URL(path, `${root}/`);
	if (token) url.searchParams.set("token", token);
	return url.toString();
}

async function fetchJson<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
	const res = await fetch(url, { cache: "no-store" });
	if (!res.ok) return { ok: false, status: res.status };
	const data = (await res.json()) as T;
	return { ok: true, data };
}

/**
 * Local-API client for OBS embeds: WS `track:change` + `track:state` (no poll).
 */
export function createEmbedHttpClient(options: EmbedHttpClientOptions): { stop: () => void } {
	const { baseUrl, token, onTrack, onStatus } = options;

	let stopped = false;
	let trackRaw: EmbedTrackLike | null = null;
	let stateRaw: EmbedStateLike | null = null;
	let ws: WebSocket | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let tickTimer: ReturnType<typeof setInterval> | null = null;
	let lastStateAt = 0;

	const emit = () => {
		onTrack(withApiThumbnail(mapTrackToViewModel(trackRaw, stateRaw), baseUrl, token));
	};

	const setStatus = (msg: string | null) => {
		onStatus?.(msg);
	};

	const loadTrack = async () => {
		const result = await fetchJson<EmbedTrackLike | null>(joinUrl(baseUrl, "/track", token));
		if (stopped) return;
		if (!result.ok) {
			if (result.status === 401) setStatus("Unauthorized — check token");
			else setStatus(`API error ${result.status}`);
			trackRaw = null;
			emit();
			return;
		}
		setStatus(null);
		trackRaw = result.data;
		emit();
	};

	const loadState = async () => {
		const result = await fetchJson<EmbedStateLike | null>(joinUrl(baseUrl, "/track/state", token));
		if (stopped) return;
		if (!result.ok) {
			if (result.status === 401) setStatus("Unauthorized — check token");
			return;
		}
		applyState(result.data);
	};

	const applyState = (next: EmbedStateLike | null) => {
		stateRaw = next;
		lastStateAt = Date.now();
		emit();
	};

	/** Smooth progress between WS `track:state` buckets while playing. */
	const startLocalTick = () => {
		if (tickTimer) return;
		tickTimer = setInterval(() => {
			if (stopped || !stateRaw?.playing) return;
			const duration = typeof stateRaw.duration === "number" ? stateRaw.duration : 0;
			const base = typeof stateRaw.progress === "number" ? stateRaw.progress : 0;
			const elapsed = (Date.now() - lastStateAt) / 1000;
			const progress = duration > 0 ? Math.min(duration, base + elapsed) : base + elapsed;
			onTrack(
				withApiThumbnail(mapTrackToViewModel(trackRaw, { ...stateRaw, progress }), baseUrl, token),
			);
		}, 200);
	};

	const connectWs = () => {
		if (stopped) return;
		const root = baseUrl.replace(/\/$/, "");
		const wsUrl = new URL("/socket", root.replace(/^http/, "ws"));
		if (token) wsUrl.searchParams.set("token", token);

		try {
			ws = new WebSocket(wsUrl.toString());
		} catch {
			scheduleReconnect();
			return;
		}

		ws.onmessage = (ev) => {
			if (stopped) return;
			try {
				if (ev.data === "null") {
					trackRaw = null;
					emit();
					return;
				}
				const parsed = JSON.parse(String(ev.data)) as {
					event?: string;
					data?: unknown[];
				};
				if (parsed?.event === "track:change" && Array.isArray(parsed.data)) {
					trackRaw = (parsed.data[0] as EmbedTrackLike | undefined) ?? null;
					setStatus(null);
					emit();
					return;
				}
				if (parsed?.event === "track:state" && Array.isArray(parsed.data)) {
					applyState((parsed.data[0] as EmbedStateLike | undefined) ?? null);
				}
			} catch {
				/* ignore malformed */
			}
		};

		ws.onopen = () => {
			setStatus(null);
			startLocalTick();
		};

		ws.onclose = () => {
			ws = null;
			if (!stopped) scheduleReconnect();
		};

		ws.onerror = () => {
			try {
				ws?.close();
			} catch {
				/* ignore */
			}
		};
	};

	const scheduleReconnect = () => {
		if (stopped || reconnectTimer) return;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			connectWs();
		}, 2000);
	};

	void (async () => {
		setStatus("Connecting…");
		await loadTrack();
		await loadState();
		if (stopped) return;
		connectWs();
		startLocalTick();
	})();

	return {
		stop() {
			stopped = true;
			if (tickTimer) clearInterval(tickTimer);
			if (reconnectTimer) clearTimeout(reconnectTimer);
			try {
				ws?.close();
			} catch {
				/* ignore */
			}
			ws = null;
		},
	};
}
