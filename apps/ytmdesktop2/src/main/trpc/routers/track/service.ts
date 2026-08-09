import { EventEmitter } from "node:events";
import { YtmClient } from "@main/ytm/ytm-client";
import { serverMain } from "@main/ipc/serverEvents";
import { getAppWindows, getLifecycleContext, getYoutubeView, onAfterInit, requireAppWindows } from "@main/lifecycle";
import { thumbnailCache } from "@main/services/thumbnailCache";
import IPC_EVENT_NAMES from "@shared/constants/eventNames";
import type { TrackData } from "@shared/track/trackData";
import {
	decideLastFmSession,
	lastFmScrobbleRemainingMs,
	preferLastFmTrack,
	relatedIdsIntersect,
	relatedVideoIds,
	shouldRefreshLastFmNowPlaying,
	trackNeedsLastFmPush,
	LASTFM_NP_REFRESH_AFTER_PAUSE_MS,
	LASTFM_SCROBBLE_MIN_DURATION_SEC,
	LASTFM_SCROBBLE_MAX_WAIT_SEC,
} from "@shared/track/lastfmTrackSession";
import { createLogger } from "@shared/utils/console";
import { observable } from "@trpc/server/observable";
import { ipcMain } from "electron";
import { clamp, clone, debounce } from "lodash-es";
import { Vibrant } from "node-vibrant/node";
import { firstBy } from "thenby";

export type TrackState = {
	id: string;
	playing: boolean;
	progress: number;
	uiProgress?: number;
	duration: number;
	liked: boolean;
	disliked: boolean;
	startedAt: number;
	percentage: number;
	eventType: "state" | "progress";
	accent: string | null;
};

type TrackControlResponse = { isPlaying: boolean; time: number };

type TrackEntry = { id: string } & TrackData;

const events = new EventEmitter();

class TrackCollection {
	private tracks: Map<string, TrackEntry> = new Map();
	private readonly maxSize = 24;

	addOrUpdate(id: string, value: Omit<TrackEntry, "id">, protectId?: string | null): TrackEntry {
		const track = { ...value, id } as TrackEntry;
		// Re-insert so Map order stays LRU (newest at end)
		if (this.tracks.has(id)) this.tracks.delete(id);
		this.tracks.set(id, track);

		while (this.tracks.size > this.maxSize) {
			const oldest = this.tracks.keys().next().value as string | undefined;
			if (!oldest) break;
			if (protectId && oldest === protectId) {
				// Skip protected — evict next oldest
				const keys = [...this.tracks.keys()];
				const victim = keys.find((k) => k !== protectId);
				if (!victim) break;
				this.tracks.delete(victim);
				continue;
			}
			this.tracks.delete(oldest);
		}

		return track;
	}

	remove(id: string): boolean {
		return this.tracks.delete(id);
	}

	findById(id: string): TrackEntry | undefined {
		return this.tracks.get(id);
	}

	clear(): void {
		this.tracks.clear();
	}
}

const trackCollection = new TrackCollection();

const parseTrackDuration = (td: TrackData): number | null => {
	return ((dur) => (dur ? Number.parseInt(dur) : null))(td.context?.videoDetails?.durationSeconds ?? td.video?.lengthSeconds);
};

const trackContentKey = (track: TrackData): string =>
	`${track.video.videoId}|${track.music?.album ?? ""}|${track.video.title}|${track.meta?.duration ?? ""}|${track.meta?.counterpartVideoId ?? ""}`;

const stateEmitKey = (state: TrackState): string =>
	[
		state.id,
		state.playing ? 1 : 0,
		// 250ms buckets — progress updates without flooding
		Math.floor(state.progress * 4),
		state.liked ? 1 : 0,
		state.disliked ? 1 : 0,
		state.accent ?? "",
		state.eventType,
		Math.floor(state.duration),
	].join("|");

export class TrackService {
	/** Heard title/id before TrackData + chrome (`_trackState.id`) catch up. */
	private _pendingTrackId: string | null = null;
	private _trackState: TrackState | null = null;
	private _trackDataCache: TrackEntry | null = null;
	private _currentPallete: { id: string; color: string } | null = null;
	private trackChangeTimeout: NodeJS.Timeout | null = null;
	private lastLastFmTrackId: string | null = null;
	/** Song + music-video counterpart ids for the active Last.fm listen session. */
	private lastLastFmRelatedIds: Set<string> = new Set();
	/** Monotonic listen id — unique scrobble/NP keys per loop. */
	private lastFmListenEpoch = 0;
	private lastTrackContentKey: string | null = null;
	private lastStateEmitKey: string | null = null;
	private pendingScrobble: {
		track: TrackData;
		videoId: string;
		relatedIds: Set<string>;
		maxProgress: number;
		createdAtMs: number;
		startedAt: number;
		epoch: number;
	} | null = null;
	/** Prevent double startFreshLastFmListen from parallel IPC. */
	private lastFmListenInFlight = false;
	/** Wall-clock when playback last went paused — resume after long idle re-pushes Last.fm NP. */
	private lastFmPausedAt: number | null = null;
	/** Delayed post-scrobble NP — clear on new listen. */
	private postScrobbleNpTimer: ReturnType<typeof setTimeout> | null = null;
	private _ipcBound = false;
	private _styleBound = false;

	/** Settle window before notifying Last.fm / socket API — UI stays instant. */
	private static readonly EXTERNAL_TRACK_DEBOUNCE_MS = 1200;

	private readonly logger = createLogger("services").child("track");

	private get app() {
		return getLifecycleContext().app;
	}

	private getProvider(name: string) {
		return getLifecycleContext().getProvider(name);
	}

	get views() {
		return requireAppWindows().views;
	}

	get windowContext() {
		return requireAppWindows();
	}

	get trackState() {
		return this._trackState;
	}

	get playing() {
		return !!this.trackState?.playing;
	}

	/** Lookup id: pending ahead of chrome, else state. */
	private get lookupTrackId(): string | null {
		return this._pendingTrackId ?? this._trackState?.id ?? null;
	}

	get trackData(): TrackEntry | null {
		const id = this.lookupTrackId;
		if (this._trackDataCache?.id === id) {
			return this._trackDataCache;
		}
		return (this._trackDataCache = id ? (trackCollection.findById(id) ?? null) : null);
	}

	bindIpcListeners(): void {
		if (this._ipcBound) return;
		this._ipcBound = true;
		// No debounce on track info — watcher already dedupes; UI must stay instant
		serverMain.on("track:info-req", (ev, data) => void this.onTrackInfo(ev, data));
		serverMain.on(IPC_EVENT_NAMES.TRACK_LIKE_STATE, (ev, data) => this.onLikeState(ev, data));
		serverMain.on("track:title-change", debounce(this.onTitleChange.bind(this), 25));
		serverMain.on(IPC_EVENT_NAMES.TRACK_PLAYSTATE, debounce(this.onPlayStateChange.bind(this), 50));
		// Last.fm + UI progress: 50ms. Discord timeline: separate 1s handler (no Last.fm).
		serverMain.on(IPC_EVENT_NAMES.TRACK_PLAYSTATE_PROGRESS, debounce(this.onPlayStateProgress.bind(this), 50));
		serverMain.on(IPC_EVENT_NAMES.TRACK_PLAYSTATE_PROGRESS, debounce(this.onProgressHandler.bind(this), 1000));
	}

	afterInit(): void {
		if (this._styleBound) return;
		if (!getYoutubeView()) return;
		this._styleBound = true;
		this.handleTrackStyle();
	}

	private log(...args: unknown[]) {
		this.logger.debug(...args);
	}

	async executeCommand<T = unknown>(command: string, ...args: unknown[]): Promise<T> {
		// api-controls plugin registers under service "api" -> plugins:api:cmd:*
		return await YtmClient.cmd<T>("api", command, ...args);
	}

	getTrackInformation(): TrackEntry | null {
		return this.trackData;
	}

	getTrackState(): TrackState | null {
		return this.trackState;
	}

	async postTrackLike(_ev: unknown, like: boolean): Promise<boolean | null> {
		// Emit intent immediately so tray view updates before YTM DOM settles.
		this.patchTrackState(like ? { liked: true, disliked: false } : { liked: false });
		const liked = await this.executeCommand<boolean>("like", like);
		const resolved = typeof liked === "boolean" ? liked : like;
		this.patchTrackState(resolved ? { liked: true, disliked: false } : { liked: false });
		// Renderer like-watcher emits settled DOM state; cmd is backup if observer lags.
		void this.currentSongLikeState().then(([isLiked, isDLiked]) => {
			this.patchTrackState({ liked: isLiked, disliked: isDLiked });
		});
		return resolved;
	}

	async postTrackDisLike(_ev: unknown, dislike: boolean): Promise<boolean | null> {
		this.patchTrackState(dislike ? { disliked: true, liked: false } : { disliked: false });
		const disliked = await this.executeCommand<boolean>("dislike", dislike);
		const resolved = typeof disliked === "boolean" ? disliked : dislike;
		this.patchTrackState(resolved ? { disliked: true, liked: false } : { disliked: false });
		void this.currentSongLikeState().then(([isLiked, isDLiked]) => {
			this.patchTrackState({ liked: isLiked, disliked: isDLiked });
		});
		return resolved;
	}

	async nextTrack(): Promise<TrackControlResponse> {
		return await this.executeCommand<TrackControlResponse>("next");
	}

	async prevTrack(): Promise<TrackControlResponse> {
		return await this.executeCommand<TrackControlResponse>("prev");
	}

	async repeatTrack(): Promise<TrackControlResponse> {
		return await this.executeCommand<TrackControlResponse>("repeat");
	}

	async shuffleTrack(): Promise<TrackControlResponse> {
		return await this.executeCommand<TrackControlResponse>("shuffle");
	}

	async volumeTrack(data?: { volume?: number }): Promise<{ volume: number }> {
		return await this.executeCommand<{ volume: number }>("volume", data);
	}

	async volumeUpTrack(data?: { amount?: number }): Promise<{ volume: number }> {
		return await this.executeCommand<{ volume: number }>("volumeUp", data);
	}

	async volumeDownTrack(data?: { amount?: number }): Promise<{ volume: number }> {
		return await this.executeCommand<{ volume: number }>("volumeDown", data);
	}

	async forwardTrack(_ev: unknown, data?: { time?: number }): Promise<TrackControlResponse> {
		const { time } = data ?? {};
		if (typeof time === "number" && time !== 0) {
			return await this.executeCommand<TrackControlResponse>("seek", { time });
		}
		throw new Error("Time is not a number");
	}

	async backwardTrack(_ev: unknown, data?: { time?: number }): Promise<TrackControlResponse> {
		const { time } = data ?? {};
		if (typeof time === "number" && time !== 0) {
			return await this.executeCommand<TrackControlResponse>("seek", { time: -time });
		}
		throw new Error("Time is not a number");
	}

	async seekTrack(_ev: unknown, data?: Partial<{ time: number; type?: "seek" }>): Promise<TrackControlResponse> {
		const { time, type } = data || {};
		if (typeof time !== "number") throw new Error("Time is not a number");
		return await this.executeCommand<TrackControlResponse>("seek", { time, type });
	}

	async playTrack(): Promise<TrackControlResponse> {
		return await this.executeCommand<TrackControlResponse>("play").then(({ isPlaying, time }) => {
			ipcMain.emit(IPC_EVENT_NAMES.TRACK_PLAYSTATE, null, isPlaying, time);
			return { isPlaying, time };
		});
	}

	async pauseTrack(): Promise<TrackControlResponse> {
		return await this.executeCommand<TrackControlResponse>("pause").then(({ isPlaying, time }) => {
			ipcMain.emit(IPC_EVENT_NAMES.TRACK_PLAYSTATE, null, isPlaying, time);
			return { isPlaying, time };
		});
	}

	async toggleTrackPlayback(): Promise<TrackControlResponse> {
		return await this.executeCommand<TrackControlResponse>("toggle").then(({ isPlaying, time }) => {
			ipcMain.emit(IPC_EVENT_NAMES.TRACK_PLAYSTATE, null, isPlaying, time);
			return { isPlaying, time };
		});
	}

	private ensureTrackState(): TrackState {
		if (!this._trackState) {
			this._trackState = {
				id: "",
				playing: false,
				progress: 0,
				duration: 0,
				liked: false,
				disliked: false,
				startedAt: Date.now() / 1000,
				percentage: 0,
				eventType: "state",
				accent: null,
			};
		}
		return this._trackState;
	}

	private commitTrackState(prevId: string): void {
		const state = this._trackState;
		if (!state) return;
		if (typeof state.percentage === "number") state.percentage = clamp(state.percentage, 0, 100);
		if (prevId !== state.id) {
			this.logger.debug("title id change", prevId, "=>", state.id);
			(this.getProvider("discord") as { updateTrackProgress?: (a: boolean, b: number, c: boolean) => void })?.updateTrackProgress?.(true, 0, true);
			if (this._pendingTrackId && this._pendingTrackId === state.id) {
				this._pendingTrackId = null;
			}
		}
		const key = stateEmitKey(state);
		if (key === this.lastStateEmitKey) return;
		this.lastStateEmitKey = key;
		// Shallow clone — in-place mutation keeps same ref; React setState skips via Object.is.
		const snapshot = { ...state };
		events.emit("track:state-change", snapshot);
		// Local API WS (OBS embeds) — already bucketed by stateEmitKey (~250ms).
		const api = this.getProvider("api") as { sendMessage?: (...args: unknown[]) => void } | undefined;
		api?.sendMessage?.("track:state", snapshot);
	}

	/**
	 * Merge into play-chrome store.
	 * New `id` → reset progress/accent/likes (unless patch supplies likes); preserve `playing` unless patched.
	 * Same `id` → shallow merge; omitted fields stay.
	 */
	patchTrackState(patch: Partial<TrackState>): void {
		const state = this.ensureTrackState();
		const prevId = state.id;
		const nextId = patch.id !== undefined ? String(patch.id) : state.id;
		const idChanged = nextId !== state.id;

		if (idChanged) {
			state.id = nextId;
			state.progress = patch.progress ?? 0;
			state.uiProgress = patch.uiProgress ?? 0;
			state.percentage = patch.percentage ?? 0;
			state.startedAt = patch.startedAt ?? Date.now() / 1000;
			state.accent = patch.accent !== undefined ? patch.accent : null;
			state.liked = patch.liked ?? false;
			state.disliked = patch.disliked ?? false;
			if (patch.duration !== undefined) state.duration = patch.duration;
			if (patch.eventType !== undefined) state.eventType = patch.eventType;
			if (patch.playing !== undefined) state.playing = patch.playing;
		} else {
			if (patch.playing !== undefined) state.playing = patch.playing;
			if (patch.progress !== undefined) state.progress = patch.progress;
			if (patch.uiProgress !== undefined) state.uiProgress = patch.uiProgress;
			if (patch.duration !== undefined) state.duration = patch.duration;
			if (patch.liked !== undefined) state.liked = patch.liked;
			if (patch.disliked !== undefined) state.disliked = patch.disliked;
			if (patch.startedAt !== undefined) state.startedAt = patch.startedAt;
			if (patch.percentage !== undefined) state.percentage = patch.percentage;
			if (patch.eventType !== undefined) state.eventType = patch.eventType;
			if (patch.accent !== undefined) state.accent = patch.accent;
		}

		this.commitTrackState(prevId);
	}

	/** In-place mutator for play/progress/accent. Object form → `patchTrackState`. */
	setTrackState(fn: TrackState | ((d: TrackState) => void | TrackState)) {
		if (typeof fn !== "function") {
			this.patchTrackState(fn);
			return;
		}
		const state = this.ensureTrackState();
		const prevId = state.id;
		const ret = fn(state);
		if (ret !== undefined) {
			this._trackState = ret as TrackState;
		}
		this.commitTrackState(prevId);
	}

	async getActiveTrackByDOM(): Promise<string | null> {
		const youtubeView = getYoutubeView();
		if (!youtubeView) return null;
		try {
			const href = await youtubeView.webContents.executeJavaScript(`document.querySelector("a.ytp-title-link.yt-uix-sessionlink")?.href`);
			return href ? (new URLSearchParams(href.split("?")[1])?.get("v") ?? null) : null;
		} catch {
			return null;
		}
	}

	async currentSongLikeState(): Promise<[boolean, boolean]> {
		try {
			const status = await this.executeCommand<{ liked?: boolean; disliked?: boolean }>("like_state");
			return [!!status?.liked, !!status?.disliked];
		} catch {
			return [false, false];
		}
	}

	onLikeState(_ev: unknown, data: { videoId?: string; liked?: boolean; disliked?: boolean }) {
		const videoId = data?.videoId ? String(data.videoId) : "";
		if (!videoId) return;
		const stateId = this._trackState?.id;
		const pendingId = this._pendingTrackId;
		if (videoId !== stateId && videoId !== pendingId) return;
		// Likes only apply to chrome when state.id matches — never set state.id from like IPC.
		if (!stateId || stateId !== videoId) return;
		this.patchTrackState({ liked: !!data.liked, disliked: !!data.disliked });
	}

	getTrackDuration(): number | null {
		const td = this.trackData;
		return td ? parseTrackDuration(td) : null;
	}

	async onTrackInfo(
		_ev: unknown,
		ytTrack: TrackData & { counterpartVideoId?: string | null; restartListen?: boolean },
	) {
		if (!ytTrack?.video?.videoId) return;

		const videoId = String(ytTrack.video.videoId);
		const restartListen = !!ytTrack.restartListen;
		const musicObject = ytTrack.music?.album ? { album: String(ytTrack.music.album) } : undefined;
		const duration = parseTrackDuration(ytTrack);
		const counterpartRaw = ytTrack.meta?.counterpartVideoId ?? ytTrack.counterpartVideoId;
		const counterpartVideoId =
			typeof counterpartRaw === "string" && counterpartRaw && counterpartRaw !== videoId ? counterpartRaw : null;
		const track = {
			video: ytTrack.video,
			context: ytTrack.context,
			meta: {
				thumbnail: (ytTrack?.video?.thumbnail?.thumbnails ?? ytTrack?.context?.thumbnail?.thumbnails)?.sort(firstBy((d) => d.height, "desc"))[0]?.url,
				isAudioExclusive: ytTrack?.video?.musicVideoType === "MUSIC_VIDEO_TYPE_ATV",
				counterpartVideoId,
				startedAt: Date.now() / 1000,
				duration,
				isAlbum: !!musicObject,
			},
			music: musicObject,
		} as TrackData;

		trackCollection.addOrUpdate(videoId, track, this.lookupTrackId);
		this._trackDataCache = null;

		const knownActive =
			(!this._pendingTrackId && !this._trackState?.id) ||
			this._pendingTrackId === videoId ||
			this._trackState?.id === videoId;
		const isActive = knownActive || (await this.getActiveTrackByDOM()) === videoId;
		if (!isActive) return;

		const key = trackContentKey(track);
		const contentChanged = key !== this.lastTrackContentKey;
		const stateOutOfSync = !this._trackState || this._trackState.id !== videoId;
		const needsLastFm = this.trackNeedsLastFm(track);

		// dataloaded on same videoId = new listen (loop / repeat-one)
		if (restartListen && !stateOutOfSync) {
			this._pendingTrackId = videoId;
			this.lastTrackContentKey = key;
			this.patchTrackState({
				id: videoId,
				duration: Number(duration ?? 0),
				progress: 0,
				uiProgress: 0,
				startedAt: Date.now() / 1000,
				percentage: 0,
				eventType: "state",
			});
			void this.onSongRestart(track);
			return;
		}

		// Same payload already fanned out — skip (no tRPC / Last.fm spam)
		if (!contentChanged && !stateOutOfSync && !needsLastFm) return;

		this._pendingTrackId = videoId;
		this.lastTrackContentKey = key;

		// Always Last.fm when id not yet submitted — do NOT key off isTrackChange vs pending
		this.pushTrackToViews(track, needsLastFm || restartListen);

		if (stateOutOfSync) {
			this.patchTrackState({
				id: videoId,
				duration: Number(duration ?? 0),
				progress: 0,
				uiProgress: 0,
				startedAt: Date.now() / 1000,
				percentage: 0,
				eventType: "state",
				accent: null,
			});
			// likes come from track-like only - immediate like_state reads stale DOM
		} else if (this._pendingTrackId === videoId) {
			this._pendingTrackId = null;
		}
	}

	async setActiveTrack(trackId: string) {
		return await this.onActiveTrack(trackId);
	}

	onTitleChange(_ev: unknown, trackId: string) {
		if (trackId) void this.onActiveTrack(trackId);
	}

	private async onActiveTrack(trackId: string) {
		if (this._pendingTrackId === trackId && this._trackState?.id === trackId) return;
		if (!this._pendingTrackId && this._trackState?.id === trackId) return;

		this.log(`active track:`, trackId);
		this._pendingTrackId = trackId;
		this._trackDataCache = null;
		const td = this.trackData;
		// Wait for onTrackInfo when payload not ready — never clear pending id
		if (!td || td.video?.videoId !== trackId) {
			this.logger.debug("active track pending info", trackId);
			return;
		}

		const key = trackContentKey(td);
		const needsLastFm = this.trackNeedsLastFm(td);
		if (key === this.lastTrackContentKey && !needsLastFm && this._trackState?.id === trackId) {
			this._pendingTrackId = null;
			return;
		}
		this.lastTrackContentKey = key;

		this.pushTrackToViews(td, needsLastFm);
		this.patchTrackState({
			id: trackId,
			duration: this.getTrackDuration() ?? 0,
			progress: 0,
			uiProgress: 0,
			startedAt: Date.now() / 1000,
			percentage: 0,
			eventType: "state",
			accent: null,
		});
		// likes come from track-like only - immediate like_state reads stale DOM
	}

	/**
	 * Instant UI fanout via tRPC EventEmitter.
	 * Last.fm / API socket settle separately so skipping does not block toolbar.
	 */
	pushTrackToViews(trackRef: TrackData, updateLastFm: boolean = true) {
		const track = clone(trackRef);
		track.meta.startedAt = Date.now() / 1000;

		// Immediate — subscribers (toolbar / tray view) get data now
		events.emit("track:change", track);

		const windows = getAppWindows();
		if (windows) {
			try {
				YtmClient.push("trackId:change", track.video.videoId);
				windows.sendToAllViews(IPC_EVENT_NAMES.TRACK_CHANGE, track);
			} catch (error) {
				this.logger.error("Failed to fanout track to views:", error);
			}
		}

		this.queueExternalTrackPush(track, updateLastFm);
	}

	private pendingExternal: { track: TrackData; updateLastFm: boolean } | null = null;

	private queueExternalTrackPush(track: TrackData, updateLastFm: boolean) {
		const prev = this.pendingExternal;
		this.pendingExternal = {
			track,
			// Keep Last.fm intent across debounce — same id or song↔video counterpart
			updateLastFm: updateLastFm || (!!prev?.updateLastFm && relatedIdsIntersect(prev.track, track)),
		};
		this.flushExternalTrackPush();
	}

	private flushExternalTrackPush = debounce(async () => {
		const pending = this.pendingExternal;
		this.pendingExternal = null;
		if (!pending) return;

		const { track, updateLastFm } = pending;
		const api = this.getProvider("api") as { sendMessage?: (...args: unknown[]) => void } | undefined;
		api?.sendMessage?.("track:change", track);

		if (!updateLastFm) return;
		await this.onSongStart(track);
	}, TrackService.EXTERNAL_TRACK_DEBOUNCE_MS);

	private async pushLastFm(track: TrackData, opts?: { forceNowPlaying?: boolean }) {
		const lastfm = this.getLastFm();
		if (!lastfm) {
			this.logger.warn("lastfm provider missing — skip now-playing");
			return;
		}

		const lastfmState = lastfm.getState();
		const videoId = track.video.videoId;
		if (!videoId) return;
		if (!lastfmState.connected || lastfmState.processing) {
			this.logger.debug("lastfm push skipped", { videoId, lastfmState });
			return;
		}

		const decision = decideLastFmSession({
			track,
			lastRelatedIds: this.lastLastFmRelatedIds,
			pending: this.pendingScrobble
				? { track: this.pendingScrobble.track, relatedIds: this.pendingScrobble.relatedIds }
				: null,
			findById: (id) => trackCollection.findById(id),
			cloneTrack: clone,
		});

		if (decision.type === "same-session-keep" || decision.type === "same-session-settled" || decision.type === "upgrade-atv") {
			for (const id of decision.relatedIds) this.lastLastFmRelatedIds.add(id);
			if (this.pendingScrobble) {
				for (const id of decision.relatedIds) this.pendingScrobble.relatedIds.add(id);
			}
		}

		if (decision.type === "same-session-keep") {
			this.logger.debug("lastfm same session skip", videoId);
			return;
		}

		if (decision.type === "same-session-settled") {
			this.logger.debug("lastfm same session already settled", videoId);
			return;
		}

		if (decision.type === "upgrade-atv") {
			if (!this.pendingScrobble) return;
			const maxProgress = this.pendingScrobble.maxProgress;
			const startedAt = this.pendingScrobble.startedAt;
			const epoch = this.pendingScrobble.epoch;
			const upgraded = structuredClone(decision.preferred);
			upgraded.meta.startedAt = startedAt;
			this.pendingScrobble.track = upgraded;
			this.pendingScrobble.videoId = decision.preferred.video.videoId;
			this.pendingScrobble.maxProgress = maxProgress;
			this.lastLastFmTrackId = decision.preferred.video.videoId;
			await lastfm.handleTrackStart(upgraded, { epoch });
			this.logger.debug("lastfm upgrade to ATV", decision.preferred.video.videoId, { lastfmState });
			return;
		}

		const preferredTrack = decision.preferred;
		const relatedIds = decision.relatedIds;

		// New track — flush previous only if it already crossed scrobble threshold
		if (this.pendingScrobble) {
			const prev = this.pendingScrobble;
			const duration = Number(prev.track.meta.duration) || 0;
			if (this.crossedScrobbleThreshold(prev.maxProgress, duration)) {
				await this.onSongEnd("track-change");
			} else {
				this.logger.debug("lastfm abandon pending scrobble", prev.videoId, { progress: prev.maxProgress, duration });
				this.pendingScrobble = null;
				this.clearScrobbleTimer();
			}
		}

		const preferredId = preferredTrack.video.videoId;
		// Same videoId is normal on loop/relisten — only skip when not forcing a fresh listen
		if (!opts?.forceNowPlaying && preferredId && preferredId === this.lastLastFmTrackId) return;

		try {
			this.lastLastFmTrackId = preferredId;
			this.lastLastFmRelatedIds = new Set(relatedIds);
			this.lastFmPausedAt = null;
			this.clearPostScrobbleNpTimer();
			const epoch = ++this.lastFmListenEpoch;
			const startedAt = Number(preferredTrack.meta.startedAt) || Date.now() / 1000;
			preferredTrack.meta.startedAt = startedAt;
			const frozen = structuredClone(preferredTrack);
			frozen.meta.startedAt = startedAt;
			this.pendingScrobble = {
				track: frozen,
				videoId: preferredId,
				relatedIds: new Set(relatedIds),
				maxProgress: 0,
				createdAtMs: Date.now(),
				startedAt,
				epoch,
			};
			await lastfm.handleTrackStart(frozen, {
				force: !!opts?.forceNowPlaying,
				epoch,
			});
			this.logger.debug("lastfm.handleTrackStart", preferredId, {
				lastfmState,
				playingId: videoId,
				preferredAudio: !!preferredTrack.meta.isAudioExclusive,
				forceNowPlaying: !!opts?.forceNowPlaying,
				epoch,
				startedAt,
			});
			this.scheduleScrobbleTimer(0);
		} catch (error) {
			this.lastLastFmTrackId = null;
			this.lastLastFmRelatedIds.clear();
			this.pendingScrobble = null;
			this.logger.error("Failed to update lastfm:", error);
		}
	}

	/** True when Last.fm needs a push: new related set, new counterpart id, or ATV upgrade. */
	private trackNeedsLastFm(track: TrackData): boolean {
		return trackNeedsLastFmPush({
			track,
			lastRelatedIds: this.lastLastFmRelatedIds,
			pending: this.pendingScrobble,
			findById: (id) => trackCollection.findById(id),
			cloneTrack: clone,
		});
	}

	private getLastFm() {
		return this.getProvider("lastfm") as
			| {
					getState: () => { connected: boolean; processing: boolean; error?: boolean };
					handleTrackStart: (
						track: TrackData,
						opts?: { force?: boolean; epoch?: number },
					) => Promise<void>;
					handleTrackChange: (
						track: TrackData,
						opts?: { epoch?: number },
					) => Promise<boolean>;
			  }
			| undefined;
	}

	/** Same listen session still active — re-push Now Playing without new scrobble timer. */
	private async refreshLastFmNowPlaying(
		reason: string,
		meta?: { pausedMs?: number; track?: TrackData },
	) {
		const lastfm = this.getLastFm();
		if (!lastfm) return;
		const lastfmState = lastfm.getState();
		if (!lastfmState.connected || lastfmState.processing) return;
		const td = this.trackData;
		if (!td?.video?.videoId) return;
		const related = relatedVideoIds(td);
		if (!related.some((id) => this.lastLastFmRelatedIds.has(id))) return;
		const track =
			meta?.track ??
			this.pendingScrobble?.track ??
			preferLastFmTrack(td, (id) => trackCollection.findById(id), clone);
		this.logger.debug("lastfm refresh now-playing", track.video.videoId, {
			reason,
			...(meta?.pausedMs != null && { pausedMs: meta.pausedMs }),
		});
		await lastfm.handleTrackStart(track, { force: true });
	}

	/**
	 * Progress → scrobble watermark only.
	 * Loop / re-listen comes from player `dataloaded` (`restartListen`), not progress wrap.
	 */
	private noteProgressForLastFm(progressSec: number, _durationSec: number, isPlaying: boolean) {
		if (!isPlaying) return;
		this.maybeScrobbleFromProgress(progressSec, _durationSec);
	}

	/** New song (different related set) — start NP + scrobble session. */
	private async onSongStart(track: TrackData): Promise<void> {
		this.logger.debug("lastfm onSongStart", track.video.videoId);
		await this.pushLastFm(track);
	}

	/** Same song loop / media reload — force fresh listen. */
	private async onSongRestart(track: TrackData): Promise<void> {
		this.logger.debug("lastfm onSongRestart", track.video.videoId);
		await this.startFreshLastFmListen(0, track);
	}

	/** Listen ended (threshold / track-change / restart flush) — scrobble if eligible. */
	private async onSongEnd(
		reason: string,
		opts?: { refreshNowPlaying?: boolean },
	): Promise<void> {
		this.logger.debug("lastfm onSongEnd", reason, this.pendingScrobble?.videoId);
		await this.tryScrobblePending(reason, opts);
	}

	/** Fresh listen: NP + scrobble timer. */
	private async startFreshLastFmListen(progressSec: number, trackOverride?: TrackData) {
		if (this.lastFmListenInFlight) return;
		this.lastFmListenInFlight = true;
		try {
			const lastfm = this.getLastFm();
			if (!lastfm?.getState().connected) return;
			const td = trackOverride ?? this.trackData;
			if (!td?.video?.videoId) return;

			const pending = this.pendingScrobble;
			if (pending) {
				const duration = Number(pending.track.meta.duration) || 0;
				if (this.crossedScrobbleThreshold(pending.maxProgress, duration)) {
					await this.onSongEnd("relisten", { refreshNowPlaying: false });
				} else {
					this.logger.debug("lastfm abandon pending on fresh listen", pending.videoId, {
						progress: pending.maxProgress,
						duration,
					});
					this.pendingScrobble = null;
					this.clearScrobbleTimer();
				}
			}

			this.clearPostScrobbleNpTimer();
			this.lastLastFmRelatedIds.clear();
			this.lastLastFmTrackId = null;
			this.lastFmPausedAt = null;

			const track = structuredClone(td);
			track.meta.startedAt = Date.now() / 1000;
			this.logger.debug("lastfm start fresh listen", track.video.videoId, { progressSec });
			await this.pushLastFm(track, { forceNowPlaying: true });
		} finally {
			this.lastFmListenInFlight = false;
		}
	}

	/**
	 * Wait = half(or 4min) − elapsed. Cleared on pause; recalculated on resume.
	 * Timer still requires maxProgress past threshold before scrobbling.
	 */
	private scheduleScrobbleTimer(elapsedSec: number = 0) {
		this.clearScrobbleTimer();
		const pending = this.pendingScrobble;
		if (!pending) return;
		const duration = Number(pending.track.meta.duration) || 0;
		const waitMs = lastFmScrobbleRemainingMs(
			duration,
			elapsedSec,
			LASTFM_SCROBBLE_MIN_DURATION_SEC,
			LASTFM_SCROBBLE_MAX_WAIT_SEC,
		);
		if (waitMs == null) {
			this.logger.debug("lastfm scrobble timer skipped — duration too short", pending.videoId, duration);
			return;
		}
		if (waitMs === 0) {
			if (this.crossedScrobbleThreshold(pending.maxProgress, duration)) {
				void this.onSongEnd("timer");
			}
			return;
		}
		const sessionIds = [...pending.relatedIds];
		const timerEpoch = pending.epoch;
		this.logger.debug("lastfm schedule scrobble timer", pending.videoId, { waitMs, elapsedSec, epoch: timerEpoch });
		this.trackChangeTimeout = setTimeout(() => {
			this.trackChangeTimeout = null;
			const cur = this.pendingScrobble;
			if (!cur || cur.epoch !== timerEpoch) return;
			if (!sessionIds.some((id) => cur.relatedIds.has(id))) return;
			const dur = Number(cur.track.meta.duration) || 0;
			if (!this.crossedScrobbleThreshold(cur.maxProgress, dur)) {
				this.logger.debug("lastfm timer skip — threshold not met", cur.videoId, {
					progress: cur.maxProgress,
					duration: dur,
				});
				return;
			}
			void this.onSongEnd("timer");
		}, waitMs);
	}

	private clearScrobbleTimer() {
		if (this.trackChangeTimeout) {
			clearTimeout(this.trackChangeTimeout);
			this.trackChangeTimeout = null;
		}
	}

	private crossedScrobbleThreshold(progressSec: number, durationSec: number): boolean {
		if (!Number.isFinite(durationSec) || durationSec < LASTFM_SCROBBLE_MIN_DURATION_SEC) return false;
		const thresholdSec = Math.min(durationSec * 0.5, LASTFM_SCROBBLE_MAX_WAIT_SEC);
		return progressSec >= thresholdSec;
	}

	private async tryScrobblePending(
		reason: string,
		opts?: { refreshNowPlaying?: boolean },
	) {
		const pending = this.pendingScrobble;
		if (!pending) return;
		const lastfm = this.getLastFm();
		if (!lastfm?.getState().connected) return;

		this.pendingScrobble = null;
		this.clearScrobbleTimer();
		for (const id of pending.relatedIds) this.lastLastFmRelatedIds.add(id);

		this.logger.debug("lastfm.handleTrackChange", pending.videoId, {
			reason,
			epoch: pending.epoch,
			startedAt: pending.startedAt,
		});
		const scrobbled = await lastfm.handleTrackChange(pending.track, { epoch: pending.epoch });
		if (!scrobbled) {
			this.logger.warn("lastfm scrobble not submitted", pending.videoId, { reason, epoch: pending.epoch });
			return;
		}

		const refreshNowPlaying = opts?.refreshNowPlaying !== false && reason !== "relisten";
		if (!refreshNowPlaying) return;

		const epoch = pending.epoch;
		const stillThisListen = () => {
			if (this.lastFmListenEpoch !== epoch) return false;
			const activeId = this.lookupTrackId;
			if (!activeId || !pending.relatedIds.has(activeId)) return false;
			if (this._trackState?.playing === false) return false;
			if (this.pendingScrobble) return this.pendingScrobble.epoch === epoch;
			// Settled this epoch — still same track until fresh listen bumps epoch
			return this.lastLastFmRelatedIds.has(activeId);
		};

		const pushNp = async (tag: string) => {
			if (!stillThisListen()) {
				this.logger.debug("lastfm post-scrobble NP skipped", { tag, videoId: pending.videoId });
				return;
			}
			this.logger.debug("lastfm post-scrobble NP", { tag, videoId: pending.videoId });
			await lastfm.handleTrackStart(pending.track, { force: true, epoch: pending.epoch });
		};

		this.clearPostScrobbleNpTimer();
		await pushNp("immediate");
		this.postScrobbleNpTimer = setTimeout(() => {
			this.postScrobbleNpTimer = null;
			void pushNp("delayed");
		}, 1500);
	}

	private clearPostScrobbleNpTimer() {
		if (this.postScrobbleNpTimer) {
			clearTimeout(this.postScrobbleNpTimer);
			this.postScrobbleNpTimer = null;
		}
	}

	async onPlayStateChange(_ev: unknown, isPlaying: boolean, progressSeconds: number = 0) {
		if (!this.trackData?.meta) return;
		const duration = Number(this.trackData.meta.duration);
		const progress = Number(progressSeconds) || 0;
		const wasPlaying = this._trackState?.playing;

		this.setTrackState((state) => {
			state.playing = isPlaying;
			state.progress = progress;
			state.uiProgress = progress;
			state.percentage = duration ? (progress / duration) * 100 : 0;
			state.duration = duration;
			state.eventType = "state";
		});

		if (!isPlaying) {
			if (wasPlaying !== false) this.lastFmPausedAt = Date.now();
			// Pause clears scrobble wait; resume recalculates remaining
			this.clearScrobbleTimer();
		} else {
			const pausedAt = this.lastFmPausedAt;
			this.lastFmPausedAt = null;
			if (wasPlaying === false) {
				if (pausedAt != null) {
					const pausedMs = Date.now() - pausedAt;
					if (shouldRefreshLastFmNowPlaying(pausedMs, LASTFM_NP_REFRESH_AFTER_PAUSE_MS)) {
						void this.refreshLastFmNowPlaying("resume-after-pause", { pausedMs });
					}
				}
				const elapsed = Math.max(progress, this.pendingScrobble?.maxProgress ?? 0);
				this.scheduleScrobbleTimer(elapsed);
			}
		}

		this.noteProgressForLastFm(progress, duration, isPlaying);
		void this.updateMediaTimeline(duration, progress, isPlaying);
	}

	private async updateMediaTimeline(_duration: number, progressSeconds: number, isPlaying: boolean) {
		// OS media controls subscribe via trackService.onTrackStateChange (mediaControl).
		const discordProvider = this.getProvider("discord") as { updateTrackProgress?: (a: boolean, b: number, c?: boolean) => Promise<void> | void };
		await discordProvider?.updateTrackProgress?.(isPlaying, progressSeconds);
	}

	async onPlayStateProgress(_ev: unknown, isPlaying: boolean, progressSeconds: number = 0) {
		if (!this.trackData?.meta) return;
		const duration = Number(this.trackData.meta.duration);
		const progress = Number(progressSeconds) || 0;
		this.setTrackState((state) => {
			state.progress = progress;
			state.uiProgress = progress;
			state.percentage = duration ? (progress / duration) * 100 : 0;
			state.playing = isPlaying;
			state.duration = duration;
			state.eventType = "progress";
		});
		// Sole progress→Last.fm path (1s onProgressHandler must not also call this)
		this.noteProgressForLastFm(progress, duration, isPlaying);
	}

	/** Throttled Discord/media timeline only — do not feed Last.fm (avoids dual-handler races). */
	async onProgressHandler(_ev: unknown, isPlaying: boolean, progressSeconds: number = 0) {
		if (!this.trackData?.meta) return;
		const duration = Number(this.trackData.meta.duration);
		await this.updateMediaTimeline(duration, progressSeconds, isPlaying);
	}

	private maybeScrobbleFromProgress(progressSec: number, durationSec: number) {
		if (!this.pendingScrobble) return;
		const activeId = this.lookupTrackId;
		if (!activeId || !this.pendingScrobble.relatedIds.has(activeId)) return;
		// Ignore absurd jumps right after fresh listen (stale IPC from prior playthrough)
		const ageMs = Date.now() - this.pendingScrobble.createdAtMs;
		if (ageMs < 8_000 && progressSec > this.pendingScrobble.maxProgress + 20 && this.pendingScrobble.maxProgress < 15) {
			this.logger.debug("lastfm ignore stale progress jump", {
				progressSec,
				maxProgress: this.pendingScrobble.maxProgress,
				ageMs,
			});
			return;
		}
		this.pendingScrobble.maxProgress = Math.max(this.pendingScrobble.maxProgress, progressSec);
		const scrobbleDuration = Number(this.pendingScrobble.track.meta.duration) || durationSec;
		if (!this.crossedScrobbleThreshold(this.pendingScrobble.maxProgress, scrobbleDuration)) return;
		void this.onSongEnd("progress");
	}

	async getTrackAccent(track: TrackData | null = this.trackData): Promise<string | null> {
		if (!track) return null;
		const thumbnailUrl = track?.video?.thumbnail?.thumbnails?.[0]?.url;
		if (!thumbnailUrl) return null;

		const videoId = track.video.videoId;
		if (this._currentPallete && this._currentPallete.id === videoId) return this._currentPallete.color;

		const color = await thumbnailCache
			.getBuffer(thumbnailUrl)
			.then((file) => (file ? Vibrant.from(file) : null))
			.then((clr) => clr?.getPalette() ?? null)
			.then((clr) => clr?.Vibrant?.hex ?? null)
			.catch((err) => {
				this.logger.error("Error extracting accent color:", err);
				return null;
			});

		if (color) this._currentPallete = { id: videoId, color };
		return color;
	}

	onTrackStateChange(callback: (state: TrackState) => void, options: { debounce?: number; immediate?: boolean } = { immediate: false }) {
		const handler = options?.debounce ? debounce(callback, options.debounce) : callback;
		if (options.immediate && this._trackState) handler(this._trackState);
		events.on("track:state-change", handler);
		this.app.on("before-quit", () => events.off("track:state-change", handler));
		return () => events.off("track:state-change", handler);
	}

	/** Instant by default. Pass `debounce` for 3rd-party sinks (Discord, etc.). */
	onTrackChange(callback: (track: TrackData) => void, options: { debounce?: number; immediate?: boolean } = { immediate: false }) {
		const handler = options?.debounce ? debounce(callback, options.debounce) : callback;
		if (options.immediate && this.trackData) handler(this.trackData);
		events.on("track:change", handler);
		this.app.on("before-quit", () => events.off("track:change", handler));
		return () => events.off("track:change", handler);
	}

	/** tRPC subscription — service EventEmitter, not ipcMain. */
	subscribeTrack() {
		return observable<TrackData | null>((emit) => {
			const handler = (track: TrackData) => emit.next(track);
			events.on("track:change", handler);
			if (this.trackData) emit.next(this.trackData);
			return () => {
				events.off("track:change", handler);
			};
		});
	}

	/** tRPC subscription — service EventEmitter, not ipcMain. */
	subscribePlayState() {
		return observable<TrackState | null>((emit) => {
			const handler = (state: TrackState) => emit.next({ ...state });
			events.on("track:state-change", handler);
			if (this._trackState) emit.next({ ...this._trackState });
			return () => {
				events.off("track:state-change", handler);
			};
		});
	}

	private handleTrackStyle() {
		if (!this.windowContext.views.youtubeView.webContents) {
			this.logger.error("youtubeView not found");
			return;
		}
		this.onTrackChange(async (track) => {
			const trackAccent = await this.getTrackAccent(track);
			this.setTrackState((state) => {
				if (state.id !== track.video.videoId) return;
				if (state.accent === trackAccent) return;
				state.accent = trackAccent;
			});
			YtmClient.push("css.thumbnail-accent", trackAccent ?? "transparent");
			this.logger.debug("track:accent", trackAccent, track.video.thumbnail.thumbnails?.[0]?.url);
		});
		this.onTrackChange(async (track) => {
			const hqThumbnail = track.context?.thumbnail?.thumbnails?.sort(firstBy((d) => d.width, "desc"))[0]?.url ?? track.meta.thumbnail;
			const thumbnailUrl = hqThumbnail ? `url(${hqThumbnail})` : "transparent";
			YtmClient.push("css.thumbnail", thumbnailUrl);
			this.logger.debug("track:thumbnail", thumbnailUrl);
		});
	}
}

export const trackService = new TrackService();

// Bind IPC before youtube view loads — avoids dropping early track:info-req / play-state.
trackService.bindIpcListeners();

onAfterInit(() => {
	trackService.afterInit();
});
