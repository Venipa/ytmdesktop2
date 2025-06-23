import { ApiWorker, createApiWorker } from "@main/api/createApiWorker";
import { AfterInit, BaseProvider } from "@main/utils/baseProvider";
import { IpcContext, IpcHandle, IpcOn } from "@main/utils/onIpcEvent";
import { type App, ipcMain } from "electron";
import fetch from "node-fetch";
import Vibrant from "node-vibrant";

import IPC_EVENT_NAMES, { API_ROUTES } from "../utils/eventNames";
import TrackProvider from "./trackProvider.plugin";

@IpcContext
export default class ApiProvider extends BaseProvider implements AfterInit {
	private _thread?: ApiWorker;
	private _currentPallete: { id: string; color: string } | null = null;

	constructor(private _app: App) {
		super("api");
	}

	async AfterInit() {
		if (this._thread) {
			await this._thread.destroy();
			this._thread = undefined;
		}

		const config = this.settingsProvider;
		if (!config?.instance?.api?.enabled) {
			this.logger.debug("API is disabled in settings");
			return;
		}

		this._thread = await createApiWorker(this, this.windowContext.main);
		const tpid = await this._thread.initialize(this.settingsProvider.instance);
		this.logger.debug("API worker initialized with pid:", tpid);
	}

	get app() {
		return this._app;
	}

	get isInitialized() {
		return !!this._thread;
	}

	sendMessage(...args: any[]) {
		return this._thread?.invoke("socket", ...args);
	}

	private get settingsProvider() {
		return this.getProvider("settings");
	}

	private get trackProvider() {
		return this.getProvider("track");
	}

	@IpcOn("settingsProvider.change", {
		filter: (key: string) => key === "api.enabled",
		debounce: 1000,
	})
	private async __onApiEnabled(key: string, value: boolean) {
		if (!value) {
			if (this._thread) {
				await this._thread.destroy();
				this._thread = undefined;
			}
		} else {
			await this.AfterInit();
		}
	}

	@IpcHandle("api/routes")
	async getRoutes() {
		return Object.values(API_ROUTES).map((x) => x.replace(/^\/?api\//, ""));
	}

	@IpcHandle(API_ROUTES.TRACK_CURRENT)
	async getTrackInformation() {
		return (this.getProvider("track") as TrackProvider)?.trackData;
	}

	@IpcHandle(API_ROUTES.TRACK_ACCENT)
	async getTrackAccent() {
		const track = await this.getTrackInformation();
		if (!track?.video?.thumbnail?.thumbnails?.[0]?.url) return null;

		const videoId = track.video.videoId;
		if (this._currentPallete?.id === videoId) return this._currentPallete.color;

		const color = await fetch(track.video.thumbnail.thumbnails[0].url)
			.then((th) => th.buffer())
			.then((file) => Vibrant.from(file))
			.then((clr) => clr.getPalette())
			.then((clr) => clr.Vibrant?.hex)
			.catch((err) => {
				this.logger.error("Error extracting accent color:", err);
				return null;
			});

		if (color) this._currentPallete = { id: videoId, color };
		return color;
	}

	@IpcHandle(API_ROUTES.TRACK_LIKE)
	async postTrackLike(_ev, like: boolean) {
		const doLike = (await this.trackProvider.currentSongLikeState())?.[0] === like;
		if (!doLike) {
			return this.views.youtubeView.webContents
				.executeJavaScript(`document.querySelector("#like-button-renderer #button-shape-like.like button").click()`)
				.then(() => this.trackProvider.currentSongLikeState())
				.catch((error) => {
					this.logger.error("Error toggling like state:", error);
					return [false];
				})
				.then(([isLiked]) => {
					this.trackProvider.setTrackState((state) => {
						state.liked = isLiked;
					});
					return isLiked;
				});
		}
		return null;
	}

	@IpcHandle(API_ROUTES.TRACK_DISLIKE)
	async postTrackDisLike(_ev, like: boolean) {
		const likeState = (await this.trackProvider.currentSongLikeState())?.[1] === like;
		if (!likeState) {
			return this.views.youtubeView.webContents
				.executeJavaScript(`document.querySelector("#like-button-renderer #button-shape-dislike.dislike button").click()`)
				.then(() => this.trackProvider.currentSongLikeState())
				.catch((error) => {
					this.logger.error("Error toggling dislike state:", error);
					return [false, false];
				})
				.then(([, _likeState]) => {
					this.trackProvider.setTrackState((state) => {
						state.disliked = _likeState;
					});
					return _likeState;
				});
		}
		return null;
	}

	@IpcHandle(API_ROUTES.TRACK_CURRENT_STATE)
	async getTrackState() {
		return (this.getProvider("track") as TrackProvider)?.trackState;
	}

	@IpcHandle(API_ROUTES.TRACK_CONTROL_NEXT)
	async nextTrack() {
		return await this.windowContext.sendTrackControl("next");
	}
	@IpcHandle(API_ROUTES.TRACK_CONTROL_REPEAT)
	async repeatTrack() {
		return await this.windowContext.sendTrackControl("repeat");
	}
	@IpcHandle(API_ROUTES.TRACK_CONTROL_SHUFFLE)
	async shuffleTrack() {
		return await this.windowContext.sendTrackControl("shuffle");
	}
	@IpcHandle(API_ROUTES.TRACK_CONTROL_FORWARD)
	async forwardTrack(_ev, data) {
		const { time } = data ?? {};
		if (typeof time === "number" && time !== 0) {
			this.views.youtubeView.webContents.send("track:seek", { time });
		}
	}

	@IpcHandle(API_ROUTES.TRACK_CONTROL_SEEK)
	async seekTrack(_ev, data: Partial<{ time: number; type?: "seek" }>) {
		const { time, type } = data || {};
		if (typeof time !== "number") return;

		this.views.youtubeView.webContents.send("track:seek", {
			time,
			type,
		});
	}

	@IpcHandle(API_ROUTES.TRACK_CONTROL_BACKWARD)
	async backwardTrack(_ev, data) {
		const { time } = data ?? {};
		if (typeof time === "number" && time !== 0) {
			this.views.youtubeView.webContents.send("track:seek", { time: -time });
		}
	}

	@IpcHandle(API_ROUTES.TRACK_CONTROL_PREV)
	async prevTrack() {
		return await this.windowContext.sendTrackControl("prev");
	}

	@IpcHandle(API_ROUTES.TRACK_CONTROL_PLAY)
	async playTrack() {
		return await this.windowContext.sendTrackControl<{ data: { isPlaying: boolean; time: number }; type: any }>("play").then(({ data: { isPlaying, time } }) => {
			ipcMain.emit(IPC_EVENT_NAMES.TRACK_PLAYSTATE, null, isPlaying, time);
			return { isPlaying, time };
		});
	}

	@IpcHandle(API_ROUTES.TRACK_CONTROL_PAUSE)
	async pauseTrack() {
		return await this.windowContext.sendTrackControl<{ data: { isPlaying: boolean; time: number }; type: any }>("pause").then(({ data: { isPlaying, time } }) => {
			ipcMain.emit(IPC_EVENT_NAMES.TRACK_PLAYSTATE, null, isPlaying, time);
			return { isPlaying, time };
		});
	}

	@IpcHandle(API_ROUTES.TRACK_CONTROL_TOGGLE_PLAY)
	async toggleTrackPlayback() {
		return await this.windowContext.sendTrackControl<{ data: { isPlaying: boolean; time: number }; type: any }>("toggle").then(({ data: { isPlaying, time } }) => {
			ipcMain.emit(IPC_EVENT_NAMES.TRACK_PLAYSTATE, null, isPlaying, time);
			return { isPlaying, time };
		});
	}
}
