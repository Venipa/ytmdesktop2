import { EventEmitter } from "events";
import { AfterInit, BaseProvider } from "@main/utils/baseProvider";
import { IpcContext, IpcOn } from "@main/utils/onIpcEvent";
import type { TrackData } from "@main/utils/trackData";
import { App } from "electron";
import { clamp, clone, debounce } from "lodash-es";
import { firstBy } from "thenby";

import IPC_EVENT_NAMES from "../utils/eventNames";
import ApiProvider from "./api.service";
import DiscordProvider from "./discord.service";

type TrackState = {
	id: string;
	playing: boolean;
	progress: number;
	uiProgress?: number;
	duration: number;
	liked: boolean;
	disliked: boolean;
	startedAt: number;
};

type TrackEntry = { id: string } & TrackData;
const events = new EventEmitter();
class TrackCollection {
	private tracks: Map<string, TrackEntry> = new Map();
	private readonly maxSize = 10;

	addOrUpdate(id: string, value: Omit<TrackEntry, "id">): TrackEntry {
		const track = { ...value, id } as TrackEntry;
		const shouldUpdateTrack = this.tracks.has(id);
		this.tracks.set(id, track);

		// Maintain size limit on add
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

@IpcContext
export default class TrackProvider extends BaseProvider implements AfterInit {
	private _activeTrackId: string | null = null;
	private _playState: "playing" | "paused" | undefined;
	private _trackState: TrackState | null = null;
	private _trackDataCache: TrackEntry | null = null;

	get playState() {
		return this._playState;
	}

	get trackState() {
		return this._trackState;
	}

	get playing() {
		return this.playState === "playing";
	}

	constructor(private app: App) {
		super("track");
	}

	async AfterInit() {}

	get trackData(): TrackEntry | null {
		if (this._trackDataCache?.id === this._activeTrackId) {
			return this._trackDataCache;
		}
		return (this._trackDataCache = this._activeTrackId ? (trackCollection.findById(this._activeTrackId) ?? null) : null);
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
			};
		}
		const prevId = this._trackState.id;
		const isFunc = typeof fn === "function";
		const ret = isFunc ? fn(this._trackState) : fn;
		const isVoid = ret === void 0 || ret === undefined;

		if (!isVoid) {
			this._trackState = ret as TrackState;
		}
		if (prevId !== this.trackState.id) {
			this.logger.debug("title id change", prevId, "=>", this.trackState.id);
			this.getProvider("discord").updateTrackProgress(true, 0); // update discord presence instantly on change
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

	@IpcOn("track:info-req")
	private async __onTrackInfo(ev: any, ytTrack: TrackData) {
		if (!ytTrack.video) return;

		const track = {
			...ytTrack,
			meta: {
				thumbnail: (ytTrack?.video?.thumbnail?.thumbnails ?? ytTrack?.context?.thumbnail?.thumbnails)?.sort(firstBy((d) => d.height, "desc"))[0]?.url,
				isAudioExclusive: ytTrack?.video?.musicVideoType === "MUSIC_VIDEO_TYPE_ATV",
				startedAt: Date.now() / 1000,
				duration: parseTrackDuration(ytTrack),
			},
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
		return await this.__onActiveTrack(trackId);
	}
	@IpcOn("track:title-change", { debounce: 100 })
	private __onTitleChange(ev: any, trackId: string) {
		if (trackId) this.__onActiveTrack(trackId);
	}

	private async __onActiveTrack(trackId: string) {
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
			});
		}
	}

	private trackChangeTimeout: NodeJS.Timeout | null = null;

	public async pushTrackToViews(trackRef: TrackData, updateLastFm: boolean = true) {
		const track = clone(trackRef);
		track.meta.startedAt = Date.now() / 1000;

		this.views.toolbarView?.webContents.send("track:title", track?.video?.title);
		this.views.youtubeView?.webContents.send("track.change", track.video.videoId);
		this.windowContext.sendToAllViews(IPC_EVENT_NAMES.TRACK_CHANGE, track);
		events.emit("track:change", track);

		try {
			const media = this.getProvider("mediaController");
			if (media?.instance) {
				await media.handleTrackMediaOSControlChange(track);
			}
		} catch (error) {
			this.logger.error("Failed to update media controls:", error);
		}

		const api = this.getProvider("api") as ApiProvider;
		api.sendMessage("track:change", track);

		const lastfm = this.getProvider("lastfm");
		const lastfmState = lastfm.getState();

		if (updateLastFm && lastfm && lastfmState.connected && !lastfmState.processing && track.video.videoId) {
			await lastfm.handleTrackStart(track);

			if (this.trackChangeTimeout) {
				clearTimeout(this.trackChangeTimeout);
			}

			this.trackChangeTimeout = setTimeout(
				() => {
					lastfm.handleTrackChange(track);
					if (this.trackChangeTimeout) {
						clearTimeout(this.trackChangeTimeout);
						this.trackChangeTimeout = null;
					}
				},
				clamp(track.meta.duration * 0.65, 30, 90) * 1000,
			);
		}
	}

	@IpcOn(IPC_EVENT_NAMES.TRACK_PLAYSTATE, { debounce: 100 })
	private async __onPlayStateChange(_ev: any, isPlaying: boolean, progressSeconds: number = 0) {
		if (!this.trackData?.meta) return;

		this._playState = isPlaying ? "playing" : "paused";
		const discordProvider = this.getProvider("discord") as DiscordProvider;

		const duration = Number(this.trackData.meta.duration);
		await discordProvider.updateTrackProgress(isPlaying, progressSeconds);

		try {
			const mediaController = this.getProvider("mediaController");
			if (mediaController?.instance) {
				mediaController.instance.setTimeline(duration, progressSeconds);
			}
		} catch (error) {
			this.logger.error("Failed to update media timeline:", error);
		}

		const [isLiked, isDLiked] = await this.currentSongLikeState();

		this.setTrackState((state) => {
			state.playing = isPlaying;
			state.progress = progressSeconds;
			state.uiProgress = progressSeconds;
			state.liked = isLiked;
			state.disliked = isDLiked;
			state.duration = duration;
		});
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
}
