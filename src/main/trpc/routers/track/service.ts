import { createSendHandler } from "@main/ipc/ipc";
import { serverMain } from "@main/ipc/serverEvents";
import { getLifecycleContext, onAfterInit } from "@main/lifecycle";
import type ApiProvider from "@main/trpc/routers/api/service";
import type DiscordProvider from "@main/trpc/routers/discord/service";
import type { BrowserWindowViews } from "@main/windows/mappedWindow";
import IPC_EVENT_NAMES from "@shared/constants/eventNames";
import type { TrackData } from "@shared/track/trackData";
import { createLogger } from "@shared/utils/console";
import { observable } from "@trpc/server/observable";
import { ipcMain } from "electron";
import { EventEmitter } from "events";
import { clamp, clone, debounce } from "lodash-es";
import Vibrant from "node-vibrant";
import { firstBy } from "thenby";

type TrackState = {
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
	private readonly maxSize = 10;

	addOrUpdate(id: string, value: Omit<TrackEntry, "id">): TrackEntry {
		const track = { ...value, id } as TrackEntry;
		const shouldUpdateTrack = this.tracks.has(id);
		this.tracks.set(id, track);

		if (!shouldUpdateTrack && this.tracks.size > this.maxSize) {
			const firstKey = this.tracks.keys().next().value;
			this.tracks.delete(firstKey);
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

export class TrackService {
	private _windows: BrowserWindowViews<any> | null = null;
	private _activeTrackId: string | null = null;
	private _trackState: TrackState | null = null;
	private _trackDataCache: TrackEntry | null = null;
	private _currentPallete: { id: string; color: string } | null = null;
	private trackChangeTimeout: NodeJS.Timeout | null = null;
	private _ipcBound = false;
	private _styleBound = false;

	private readonly logger = createLogger("services").child("track");

	private get app() {
		return getLifecycleContext().app;
	}

	private getProvider(name: string) {
		return getLifecycleContext().getProvider(name);
	}

	get views() {
		return this._windows!.views;
	}

	get windowContext() {
		return this._windows!;
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

	attach(windows: BrowserWindowViews<any>): void {
		this._windows = windows;
	}

	bindIpcListeners(): void {
		if (this._ipcBound) return;
		this._ipcBound = true;
		serverMain.on("track:info-req", debounce(this.onTrackInfo.bind(this), 10));
		serverMain.on("track:title-change", debounce(this.onTitleChange.bind(this), 100));
		serverMain.on(IPC_EVENT_NAMES.TRACK_PLAYSTATE, debounce(this.onPlayStateChange.bind(this), 100));
		serverMain.on(IPC_EVENT_NAMES.TRACK_PLAYSTATE_PROGRESS, debounce(this.onPlayStateProgress.bind(this), 100));
		serverMain.on(IPC_EVENT_NAMES.TRACK_PLAYSTATE_PROGRESS, debounce(this.onProgressHandler.bind(this), 1000));
	}

	afterInit(): void {
		if (this._styleBound) return;
		if (!this._windows?.views?.youtubeView) return;
		this._styleBound = true;
		this.handleTrackStyle();
	}

	private log(...args: unknown[]) {
		this.logger.debug(...args);
	}

	async executeCommand<T = unknown>(command: string, ...args: unknown[]): Promise<T> {
		return await createSendHandler<T>(this.views.youtubeView, `plugins:track:cmd:${command}`)(...args);
	}

	getTrackInformation() {
		return this.trackData;
	}

	getTrackState() {
		return this.trackState;
	}

	async postTrackLike(_ev: unknown, like: boolean) {
		return await this.executeCommand<boolean>("like", like);
	}

	async postTrackDisLike(_ev: unknown, dislike: boolean) {
		return await this.executeCommand<boolean>("dislike", dislike);
	}

	async nextTrack() {
		return await this.executeCommand<TrackControlResponse>("next");
	}

	async prevTrack() {
		return await this.executeCommand<TrackControlResponse>("prev");
	}

	async repeatTrack() {
		return await this.executeCommand<TrackControlResponse>("repeat");
	}

	async shuffleTrack() {
		return await this.executeCommand<TrackControlResponse>("shuffle");
	}

	async forwardTrack(_ev: unknown, data?: { time?: number }) {
		const { time } = data ?? {};
		if (typeof time === "number" && time !== 0) {
			return await this.executeCommand<TrackControlResponse>("seek", { time });
		}
		throw new Error("Time is not a number");
	}

	async backwardTrack(_ev: unknown, data?: { time?: number }) {
		const { time } = data ?? {};
		if (typeof time === "number" && time !== 0) {
			return await this.executeCommand<TrackControlResponse>("seek", { time: -time });
		}
		throw new Error("Time is not a number");
	}

	async seekTrack(_ev: unknown, data?: Partial<{ time: number; type?: "seek" }>) {
		const { time, type } = data || {};
		if (typeof time !== "number") throw new Error("Time is not a number");
		return await this.executeCommand<TrackControlResponse>("seek", { time, type });
	}

	async playTrack() {
		return await this.executeCommand<TrackControlResponse>("play").then(({ isPlaying, time }) => {
			ipcMain.emit(IPC_EVENT_NAMES.TRACK_PLAYSTATE, null, isPlaying, time);
			return { isPlaying, time };
		});
	}

	async pauseTrack() {
		return await this.executeCommand<TrackControlResponse>("pause").then(({ isPlaying, time }) => {
			ipcMain.emit(IPC_EVENT_NAMES.TRACK_PLAYSTATE, null, isPlaying, time);
			return { isPlaying, time };
		});
	}

	async toggleTrackPlayback() {
		return await this.executeCommand<TrackControlResponse>("toggle").then(({ isPlaying, time }) => {
			ipcMain.emit(IPC_EVENT_NAMES.TRACK_PLAYSTATE, null, isPlaying, time);
			return { isPlaying, time };
		});
	}

	setTrackState(fn: TrackState | ((d: TrackState) => void | TrackState)) {
		if (!this._trackState) {
			this._trackState = {
				id: this._activeTrackId,
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
		const prevId = this._trackState.id;
		const isFunc = typeof fn === "function";
		const ret = isFunc ? fn(this._trackState) : fn;
		const isVoid = ret === void 0 || ret === undefined;

		if (!isVoid) {
			this._trackState = ret as TrackState;
		}
		if (typeof this.trackState?.percentage === "number") this.trackState.percentage = clamp(this.trackState.percentage, 0, 100);
		if (prevId !== this.trackState.id) {
			this.logger.debug("title id change", prevId, "=>", this.trackState.id);
			(this.getProvider("discord") as DiscordProvider).updateTrackProgress(true, 0, true);
		}
		this.windowContext.sendToAllViews("track:play-state", {
			...this._trackState,
		});
		events.emit("track:state-change", this._trackState);
	}

	async getActiveTrackByDOM(): Promise<string | null> {
		try {
			const href = await this.views.youtubeView.webContents.executeJavaScript(`document.querySelector("a.ytp-title-link.yt-uix-sessionlink")?.href`);
			return href ? (new URLSearchParams(href.split("?")[1])?.get("v") ?? null) : null;
		} catch {
			return null;
		}
	}

	async currentSongLikeState(): Promise<[boolean, boolean]> {
		try {
			const values = await this.views.youtubeView.webContents.executeJavaScript(
				`[
          document.querySelector("#like-button-renderer #button-shape-like.like button")?.ariaPressed,
          document.querySelector("#like-button-renderer #button-shape-dislike.dislike button")?.ariaPressed
        ]`,
			);
			return values.map((x: string) => x === "true") as [boolean, boolean];
		} catch {
			return [false, false];
		}
	}

	getTrackDuration(): number | null {
		const td = this.trackData;
		return td ? parseTrackDuration(td) : null;
	}

	async onTrackInfo(_ev: unknown, ytTrack: TrackData) {
		if (!ytTrack.video) return;
		const musicObject = ytTrack.music?.album ? { ...ytTrack.music } : undefined;
		const track = {
			...ytTrack,
			meta: {
				thumbnail: (ytTrack?.video?.thumbnail?.thumbnails ?? ytTrack?.context?.thumbnail?.thumbnails)?.sort(firstBy((d) => d.height, "desc"))[0]?.url,
				isAudioExclusive: ytTrack?.video?.musicVideoType === "MUSIC_VIDEO_TYPE_ATV",
				startedAt: Date.now() / 1000,
				duration: parseTrackDuration(ytTrack),
				isAlbum: !!musicObject,
			},
			music: musicObject,
		};

		trackCollection.addOrUpdate(ytTrack.video.videoId, track as TrackData);

		const currentTrackId = await this.getActiveTrackByDOM();
		if (!this._activeTrackId || track.video.videoId === this._activeTrackId || currentTrackId === track.video.videoId) {
			const lastTrackId = this._activeTrackId;
			this._activeTrackId = track.video.videoId;
			await this.pushTrackToViews(track as TrackData, lastTrackId !== track.video.videoId);
		}
	}

	async setActiveTrack(trackId: string) {
		return await this.onActiveTrack(trackId);
	}

	onTitleChange(_ev: unknown, trackId: string) {
		if (trackId) this.onActiveTrack(trackId);
	}

	private async onActiveTrack(trackId: string) {
		if (this._activeTrackId === trackId) return;

		this.log(`active track:`, trackId);
		this._activeTrackId = trackId;
		if (this.trackData) {
			const td = this.trackData;
			const [isLiked, isDLiked] = await this.currentSongLikeState();
			await this.pushTrackToViews(td);

			this.setTrackState({
				id: trackId,
				playing: this.playing,
				duration: this.getTrackDuration() ?? 0,
				liked: isLiked,
				disliked: isDLiked,
				progress: 0,
				uiProgress: 0,
				startedAt: Date.now() / 1000,
				percentage: 0,
				eventType: "state",
				accent: null,
			});
		} else {
			this._activeTrackId = null;
		}
	}

	async pushTrackToViews(trackRef: TrackData, updateLastFm: boolean = true) {
		const track = clone(trackRef);
		track.meta.startedAt = Date.now() / 1000;

		this.views.youtubeView?.webContents.send("trackId:change", track.video.videoId);
		this.windowContext.sendToAllViews(IPC_EVENT_NAMES.TRACK_CHANGE, track);
		events.emit("track:change", track);

		try {
			const media = this.getProvider("mediaControl") as { instance?: { setTimeline: (duration: number, progress: number) => void }; handleTrackMediaOSControlChange?: (track: TrackData) => Promise<void> };
			if (media?.instance) {
				await media.handleTrackMediaOSControlChange?.(track);
			}
		} catch (error) {
			this.logger.error("Failed to update media controls:", error);
		}

		const api = this.getProvider("api") as ApiProvider;
		api.sendMessage("track:change", track);

		const lastfm = this.getProvider("lastfm") as {
			getState: () => { connected: boolean; processing: boolean };
			handleTrackStart: (track: TrackData) => Promise<void>;
			handleTrackChange: (track: TrackData) => void;
		};
		const lastfmState = lastfm.getState();
		try {
			if (updateLastFm && lastfm && lastfmState.connected && !lastfmState.processing && track.video.videoId) {
				await lastfm.handleTrackStart(track);
				this.logger.debug("lastfm.handleTrackStart", track.video.videoId, { lastfmState });
				if (this.trackChangeTimeout) {
					clearTimeout(this.trackChangeTimeout);
				}

				this.trackChangeTimeout = setTimeout(
					() => {
						this.logger.debug("lastfm.handleTrackChange", track.video.videoId, { lastfmState });
						lastfm.handleTrackChange(track);
						if (this.trackChangeTimeout) {
							clearTimeout(this.trackChangeTimeout);
							this.trackChangeTimeout = null;
						}
					},
					clamp(track.meta.duration * 0.65, 30, 90) * 1000,
				);
			}
		} catch (error) {
			this.logger.error("Failed to update lastfm:", error);
		}
	}

	async onPlayStateChange(_ev: unknown, isPlaying: boolean, progressSeconds: number = 0) {
		if (!this.trackData?.meta) return;
		const duration = Number(this.trackData.meta.duration);
		await this.updateMediaTimeline(duration, progressSeconds, isPlaying);
		const [isLiked, isDLiked] = await this.currentSongLikeState();

		this.setTrackState((state) => {
			state.playing = isPlaying;
			if (state.progress !== progressSeconds) {
				state.progress = progressSeconds;
				state.uiProgress = progressSeconds;
				state.percentage = (progressSeconds / duration) * 100;
			}
			state.liked = isLiked;
			state.disliked = isDLiked;
			state.duration = duration;
			state.eventType = "state";
		});
	}

	private async updateMediaTimeline(duration: number, progressSeconds: number, isPlaying: boolean) {
		const discordProvider = this.getProvider("discord") as DiscordProvider;
		await discordProvider.updateTrackProgress(isPlaying, progressSeconds);
		try {
			const mediaController = this.getProvider("mediaControl") as { instance?: { setTimeline: (duration: number, progress: number) => void } };
			if (mediaController?.instance) {
				mediaController.instance.setTimeline(duration, progressSeconds);
			}
		} catch (error) {
			this.logger.error("Failed to update media timeline:", error);
		}
	}

	async onPlayStateProgress(_ev: unknown, isPlaying: boolean, progressSeconds: number = 0) {
		if (!this.trackData?.meta) return;
		const duration = Number(this.trackData.meta.duration);
		this.setTrackState((state) => {
			state.progress = progressSeconds;
			state.uiProgress = progressSeconds;
			state.percentage = (progressSeconds / duration) * 100;
			state.playing = isPlaying;
			state.eventType = "progress";
		});
	}

	async onProgressHandler(_ev: unknown, isPlaying: boolean, progressSeconds: number = 0) {
		if (!this.trackData?.meta) return;
		const duration = Number(this.trackData.meta.duration);
		await this.updateMediaTimeline(duration, progressSeconds, isPlaying);
	}

	async getTrackAccent(track: TrackData = this.trackData!) {
		const thumbnailUrl = track?.video?.thumbnail?.thumbnails?.[0]?.url;
		if (!thumbnailUrl) return null;

		const videoId = track.video.videoId;
		if (this._currentPallete && this._currentPallete.id === videoId) return this._currentPallete.color;

		const color = await fetch(thumbnailUrl)
			.then((th) => th.arrayBuffer())
			.then((file) => Vibrant.from(Buffer.from(file)))
			.then((clr) => clr.getPalette())
			.then((clr) => clr.Vibrant?.hex)
			.catch((err) => {
				this.logger.error("Error extracting accent color:", err);
				return null;
			});

		if (color) this._currentPallete = { id: videoId, color };
		return color;
	}

	onTrackStateChange(callback: (state: TrackState) => void, options: { debounce?: number; immediate?: boolean } = { immediate: false }) {
		const handler = debounce(callback, options?.debounce);
		if (options.immediate) handler(this.trackState);
		events.on("track:state-change", handler);
		this.app.on("before-quit", () => events.off("track:state-change", handler));
		return () => events.off("track:state-change", handler);
	}

	onTrackChange(callback: (track: TrackData) => void, options: { debounce?: number; immediate?: boolean } = { debounce: 1000, immediate: false }) {
		const handler = debounce(callback, options?.debounce);
		if (options.immediate) handler(this.trackData);
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
			const handler = (state: TrackState) => emit.next(state);
			events.on("track:state-change", handler);
			if (this._trackState) emit.next(this._trackState);
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

onAfterInit(({ windows }) => {
	if (windows) trackService.attach(windows);
	trackService.bindIpcListeners();
	trackService.afterInit();
});
