import { EventEmitter } from "node:events";
import { createSendHandler } from "@main/ipc/ipc";
import { serverMain } from "@main/ipc/serverEvents";
import { getAppWindows, getLifecycleContext, getYoutubeView, onAfterInit, requireAppWindows } from "@main/lifecycle";
import { thumbnailCache } from "@main/services/thumbnailCache";
import IPC_EVENT_NAMES from "@shared/constants/eventNames";
import type { TrackData } from "@shared/track/trackData";
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
	`${track.video.videoId}|${track.music?.album ?? ""}|${track.video.title}|${track.meta?.duration ?? ""}`;

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
	private _activeTrackId: string | null = null;
	private _trackState: TrackState | null = null;
	private _trackDataCache: TrackEntry | null = null;
	private _currentPallete: { id: string; color: string } | null = null;
	private trackChangeTimeout: NodeJS.Timeout | null = null;
	private lastLastFmTrackId: string | null = null;
	private lastTrackContentKey: string | null = null;
	private lastStateEmitKey: string | null = null;
	private pendingScrobble: { track: TrackData; videoId: string; maxProgress: number } | null = null;
	private _ipcBound = false;
	private _styleBound = false;

	/** Settle window before notifying Last.fm / socket API — UI stays instant. */
	private static readonly EXTERNAL_TRACK_DEBOUNCE_MS = 1200;
	/** Last.fm: half duration or 4 minutes, whichever shorter; tracks <30s skipped. */
	private static readonly SCROBBLE_MIN_DURATION_SEC = 30;
	private static readonly SCROBBLE_MAX_WAIT_SEC = 240;

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

	get trackData(): TrackEntry | null {
		if (this._trackDataCache?.id === this._activeTrackId) {
			return this._trackDataCache;
		}
		return (this._trackDataCache = this._activeTrackId ? (trackCollection.findById(this._activeTrackId) ?? null) : null);
	}

	bindIpcListeners(): void {
		if (this._ipcBound) return;
		this._ipcBound = true;
		// No debounce on track info — watcher already dedupes; UI must stay instant
		serverMain.on("track:info-req", (ev, data) => void this.onTrackInfo(ev, data));
		serverMain.on("track:title-change", debounce(this.onTitleChange.bind(this), 25));
		serverMain.on(IPC_EVENT_NAMES.TRACK_PLAYSTATE, debounce(this.onPlayStateChange.bind(this), 50));
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
		const youtubeView = getYoutubeView();
		if (!youtubeView) {
			throw new Error(`TrackService: youtube view not ready for command "${command}"`);
		}
		// track-api-controls plugin registers under service "api" → plugins:api:cmd:*
		return await createSendHandler<T>(youtubeView, `plugins:api:cmd:${command}`)(...args);
	}

	getTrackInformation(): TrackEntry | null {
		return this.trackData;
	}

	getTrackState(): TrackState | null {
		return this.trackState;
	}

	async postTrackLike(_ev: unknown, like: boolean): Promise<boolean | null> {
		// Emit intent immediately so tray/miniplayer update before YTM DOM settles.
		this.setTrackState((state) => {
			state.liked = like;
			if (like) state.disliked = false;
		});
		const liked = await this.executeCommand<boolean>("like", like);
		const resolved = typeof liked === "boolean" ? liked : like;
		this.setTrackState((state) => {
			if (state.liked === resolved && (!resolved || !state.disliked)) return;
			state.liked = resolved;
			if (resolved) state.disliked = false;
		});
		// Verify from DOM after YTM finishes updating aria-pressed.
		void this.currentSongLikeState().then(([isLiked, isDLiked]) => {
			this.setTrackState((state) => {
				if (state.liked === isLiked && state.disliked === isDLiked) return;
				state.liked = isLiked;
				state.disliked = isDLiked;
			});
		});
		return resolved;
	}

	async postTrackDisLike(_ev: unknown, dislike: boolean): Promise<boolean | null> {
		this.setTrackState((state) => {
			state.disliked = dislike;
			if (dislike) state.liked = false;
		});
		const disliked = await this.executeCommand<boolean>("dislike", dislike);
		const resolved = typeof disliked === "boolean" ? disliked : dislike;
		this.setTrackState((state) => {
			if (state.disliked === resolved && (!resolved || !state.liked)) return;
			state.disliked = resolved;
			if (resolved) state.liked = false;
		});
		void this.currentSongLikeState().then(([isLiked, isDLiked]) => {
			this.setTrackState((state) => {
				if (state.liked === isLiked && state.disliked === isDLiked) return;
				state.liked = isLiked;
				state.disliked = isDLiked;
			});
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

	setTrackState(fn: TrackState | ((d: TrackState) => void | TrackState)) {
		if (!this._trackState) {
			this._trackState = {
				id: this._activeTrackId ?? "",
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
		const state = this._trackState;
		const prevId = state.id;
		const isFunc = typeof fn === "function";
		const ret = isFunc ? fn(state) : fn;
		const isVoid = ret === void 0 || ret === undefined;

		if (!isVoid) {
			this._trackState = ret as TrackState;
		}
		if (typeof this._trackState.percentage === "number") this._trackState.percentage = clamp(this._trackState.percentage, 0, 100);
		if (prevId !== this._trackState.id) {
			this.logger.debug("title id change", prevId, "=>", this._trackState.id);
			(this.getProvider("discord") as { updateTrackProgress?: (a: boolean, b: number, c: boolean) => void })?.updateTrackProgress?.(true, 0, true);
		}

		const key = stateEmitKey(this._trackState);
		if (key === this.lastStateEmitKey) return;
		this.lastStateEmitKey = key;
		// Shallow clone — in-place mutation keeps same ref; React setState skips via Object.is.
		events.emit("track:state-change", { ...this._trackState });
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
		const youtubeView = getYoutubeView();
		if (!youtubeView) return [false, false];
		try {
			// Prefer like-status on the renderer — aria-pressed on dislike is unreliable in YTM.
			const status = await youtubeView.webContents.executeJavaScript(
				`(() => {
					const el = document.querySelector("#like-button-renderer, ytmusic-like-button-renderer");
					return (el?.getAttribute("like-status") || el?.getAttribute("like_status") || "").toUpperCase();
				})()`,
			);
			if (typeof status === "string" && status.length > 0) {
				return [status === "LIKE", status === "DISLIKE"];
			}
			const values = await youtubeView.webContents.executeJavaScript(
				`[
          document.querySelector("#like-button-renderer #button-shape-like.like button")?.getAttribute("aria-pressed"),
          document.querySelector("#like-button-renderer #button-shape-dislike.dislike button")?.getAttribute("aria-pressed")
        ]`,
			);
			return [(values?.[0] === "true"), (values?.[1] === "true")] as [boolean, boolean];
		} catch {
			return [false, false];
		}
	}

	getTrackDuration(): number | null {
		const td = this.trackData;
		return td ? parseTrackDuration(td) : null;
	}

	async onTrackInfo(_ev: unknown, ytTrack: TrackData) {
		if (!ytTrack?.video?.videoId) return;

		const videoId = String(ytTrack.video.videoId);
		const musicObject = ytTrack.music?.album ? { album: String(ytTrack.music.album) } : undefined;
		const duration = parseTrackDuration(ytTrack);
		const track = {
			video: ytTrack.video,
			context: ytTrack.context,
			meta: {
				thumbnail: (ytTrack?.video?.thumbnail?.thumbnails ?? ytTrack?.context?.thumbnail?.thumbnails)?.sort(firstBy((d) => d.height, "desc"))[0]?.url,
				isAudioExclusive: ytTrack?.video?.musicVideoType === "MUSIC_VIDEO_TYPE_ATV",
				startedAt: Date.now() / 1000,
				duration,
				isAlbum: !!musicObject,
			},
			music: musicObject,
		} as TrackData;

		trackCollection.addOrUpdate(videoId, track, this._activeTrackId);
		this._trackDataCache = null;

		const knownActive = !this._activeTrackId || this._activeTrackId === videoId;
		const isActive = knownActive || (await this.getActiveTrackByDOM()) === videoId;
		if (!isActive) return;

		const key = trackContentKey(track);
		const contentChanged = key !== this.lastTrackContentKey;
		const stateOutOfSync = !this._trackState || this._trackState.id !== videoId;
		// Title-change often sets _activeTrackId before info arrives — still a new track for Last.fm
		const needsLastFm = videoId !== this.lastLastFmTrackId;

		// Same payload already fanned out — skip (no tRPC / Last.fm spam)
		if (!contentChanged && !stateOutOfSync && !needsLastFm) return;

		this._activeTrackId = videoId;
		this.lastTrackContentKey = key;

		// Always Last.fm when id not yet submitted — do NOT key off isTrackChange vs _activeTrackId
		this.pushTrackToViews(track, needsLastFm);

		if (stateOutOfSync) {
			this.setTrackState({
				id: videoId,
				playing: this.playing,
				duration: Number(duration ?? 0),
				liked: false,
				disliked: false,
				progress: 0,
				uiProgress: 0,
				startedAt: Date.now() / 1000,
				percentage: 0,
				eventType: "state",
				accent: null,
			});
			void this.currentSongLikeState().then(([isLiked, isDLiked]) => {
				this.setTrackState((state) => {
					if (state.id !== videoId) return;
					if (state.liked === isLiked && state.disliked === isDLiked) return;
					state.liked = isLiked;
					state.disliked = isDLiked;
				});
			});
		}
	}

	async setActiveTrack(trackId: string) {
		return await this.onActiveTrack(trackId);
	}

	onTitleChange(_ev: unknown, trackId: string) {
		if (trackId) void this.onActiveTrack(trackId);
	}

	private async onActiveTrack(trackId: string) {
		if (this._activeTrackId === trackId && this._trackState?.id === trackId) return;

		this.log(`active track:`, trackId);
		this._activeTrackId = trackId;
		this._trackDataCache = null;
		const td = this.trackData;
		// Wait for onTrackInfo when payload not ready — never clear pending id
		if (!td || td.video?.videoId !== trackId) {
			this.logger.debug("active track pending info", trackId);
			return;
		}

		const key = trackContentKey(td);
		const needsLastFm = trackId !== this.lastLastFmTrackId;
		if (key === this.lastTrackContentKey && !needsLastFm && this._trackState?.id === trackId) return;
		this.lastTrackContentKey = key;

		this.pushTrackToViews(td, needsLastFm);
		this.setTrackState({
			id: trackId,
			playing: this.playing,
			duration: this.getTrackDuration() ?? 0,
			liked: false,
			disliked: false,
			progress: 0,
			uiProgress: 0,
			startedAt: Date.now() / 1000,
			percentage: 0,
			eventType: "state",
			accent: null,
		});

		const [isLiked, isDLiked] = await this.currentSongLikeState();
		this.setTrackState((state) => {
			if (state.id !== trackId) return;
			if (state.liked === isLiked && state.disliked === isDLiked) return;
			state.liked = isLiked;
			state.disliked = isDLiked;
		});
	}

	/**
	 * Instant UI fanout via tRPC EventEmitter.
	 * Last.fm / API socket settle separately so skipping does not block toolbar.
	 */
	pushTrackToViews(trackRef: TrackData, updateLastFm: boolean = true) {
		const track = clone(trackRef);
		track.meta.startedAt = Date.now() / 1000;

		// Immediate — subscribers (toolbar / miniplayer) get data now
		events.emit("track:change", track);

		const windows = getAppWindows();
		if (windows) {
			try {
				windows.views.youtubeView?.webContents.send("trackId:change", track.video.videoId);
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
			// Keep Last.fm intent if any queued push for this settle window asked for it
			updateLastFm: updateLastFm || (!!prev?.updateLastFm && prev.track.video.videoId === track.video.videoId),
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
		await this.pushLastFm(track);
	}, TrackService.EXTERNAL_TRACK_DEBOUNCE_MS);

	private async pushLastFm(track: TrackData) {
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

		// New track — flush previous only if it already crossed scrobble threshold
		if (this.pendingScrobble && this.pendingScrobble.videoId !== videoId) {
			const prev = this.pendingScrobble;
			const duration = Number(prev.track.meta.duration) || 0;
			if (this.crossedScrobbleThreshold(prev.maxProgress, duration)) {
				this.tryScrobblePending("track-change");
			} else {
				this.logger.debug("lastfm abandon pending scrobble", prev.videoId, { progress: prev.maxProgress, duration });
				this.pendingScrobble = null;
				if (this.trackChangeTimeout) {
					clearTimeout(this.trackChangeTimeout);
					this.trackChangeTimeout = null;
				}
			}
		}

		if (videoId === this.lastLastFmTrackId) return;

		try {
			this.lastLastFmTrackId = videoId;
			this.pendingScrobble = { track, videoId, maxProgress: 0 };
			await lastfm.handleTrackStart(track);
			this.logger.debug("lastfm.handleTrackStart", videoId, { lastfmState });

			if (this.trackChangeTimeout) clearTimeout(this.trackChangeTimeout);
			const waitMs = this.scrobbleWaitMs(Number(track.meta.duration) || 0);
			if (waitMs == null) {
				this.logger.debug("lastfm scrobble timer skipped — duration too short", videoId, track.meta.duration);
				return;
			}
			this.trackChangeTimeout = setTimeout(() => {
				this.tryScrobblePending("timer");
				this.trackChangeTimeout = null;
			}, waitMs);
		} catch (error) {
			this.lastLastFmTrackId = null;
			this.pendingScrobble = null;
			this.logger.error("Failed to update lastfm:", error);
		}
	}

	private getLastFm() {
		return this.getProvider("lastfm") as
			| {
					getState: () => { connected: boolean; processing: boolean; error?: boolean };
					handleTrackStart: (track: TrackData) => Promise<void>;
					handleTrackChange: (track: TrackData) => void;
			  }
			| undefined;
	}

	/** Half duration or 4min (Last.fm). Null = track too short to scrobble. */
	private scrobbleWaitMs(durationSec: number): number | null {
		if (!Number.isFinite(durationSec) || durationSec < TrackService.SCROBBLE_MIN_DURATION_SEC) return null;
		const thresholdSec = Math.min(durationSec * 0.5, TrackService.SCROBBLE_MAX_WAIT_SEC);
		return thresholdSec * 1000;
	}

	private crossedScrobbleThreshold(progressSec: number, durationSec: number): boolean {
		if (!Number.isFinite(durationSec) || durationSec < TrackService.SCROBBLE_MIN_DURATION_SEC) return false;
		const thresholdSec = Math.min(durationSec * 0.5, TrackService.SCROBBLE_MAX_WAIT_SEC);
		return progressSec >= thresholdSec;
	}

	private tryScrobblePending(reason: string) {
		const pending = this.pendingScrobble;
		if (!pending) return;
		const lastfm = this.getLastFm();
		if (!lastfm?.getState().connected) return;

		this.pendingScrobble = null;
		if (this.trackChangeTimeout) {
			clearTimeout(this.trackChangeTimeout);
			this.trackChangeTimeout = null;
		}
		this.logger.debug("lastfm.handleTrackChange", pending.videoId, { reason });
		lastfm.handleTrackChange(pending.track);
	}

	async onPlayStateChange(_ev: unknown, isPlaying: boolean, progressSeconds: number = 0) {
		if (!this.trackData?.meta) return;
		const duration = Number(this.trackData.meta.duration);
		const progress = Number(progressSeconds) || 0;

		this.setTrackState((state) => {
			state.playing = isPlaying;
			state.progress = progress;
			state.uiProgress = progress;
			state.percentage = duration ? (progress / duration) * 100 : 0;
			state.duration = duration;
			state.eventType = "state";
		});

		this.maybeScrobbleFromProgress(progress, duration);
		void this.updateMediaTimeline(duration, progress, isPlaying);
		void this.currentSongLikeState().then(([isLiked, isDLiked]) => {
			this.setTrackState((state) => {
				if (state.liked === isLiked && state.disliked === isDLiked) return;
				state.liked = isLiked;
				state.disliked = isDLiked;
			});
		});
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
		this.maybeScrobbleFromProgress(progress, duration);
	}

	async onProgressHandler(_ev: unknown, isPlaying: boolean, progressSeconds: number = 0) {
		if (!this.trackData?.meta) return;
		const duration = Number(this.trackData.meta.duration);
		const progress = Number(progressSeconds) || 0;
		this.maybeScrobbleFromProgress(progress, duration);
		await this.updateMediaTimeline(duration, progressSeconds, isPlaying);
	}

	private maybeScrobbleFromProgress(progressSec: number, durationSec: number) {
		if (!this.pendingScrobble) return;
		if (this.pendingScrobble.videoId !== this._activeTrackId) return;
		this.pendingScrobble.maxProgress = Math.max(this.pendingScrobble.maxProgress, progressSec);
		if (!this.crossedScrobbleThreshold(progressSec, durationSec)) return;
		this.tryScrobblePending("progress");
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
			this.windowContext.views.youtubeView.webContents.send("css.thumbnail-accent", trackAccent ?? "transparent");
			this.logger.debug("track:accent", trackAccent, track.video.thumbnail.thumbnails?.[0]?.url);
		});
		this.onTrackChange(async (track) => {
			const hqThumbnail = track.context?.thumbnail?.thumbnails?.sort(firstBy((d) => d.width, "desc"))[0]?.url ?? track.meta.thumbnail;
			const thumbnailUrl = hqThumbnail ? `url(${hqThumbnail})` : "transparent";
			this.windowContext.views.youtubeView.webContents.send("css.thumbnail", thumbnailUrl);
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
