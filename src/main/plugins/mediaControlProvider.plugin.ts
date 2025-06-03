import { AfterInit, BaseProvider, BeforeStart, OnDestroy } from "@main/utils/baseProvider";
import { IpcContext, IpcOn } from "@main/utils/onIpcEvent";
import { TrackData } from "@main/utils/trackData";
import { type App, app } from "electron";
import { MediaPlayerMediaType, MediaPlayerPlaybackStatus, MediaPlayerThumbnail, MediaPlayerThumbnailType, MediaPlayer as MediaServiceProvider } from "xosms";

import { clamp } from "lodash-es";
import IPC_EVENT_NAMES from "../utils/eventNames";

@IpcContext
export default class MediaControlProvider extends BaseProvider implements AfterInit, BeforeStart, OnDestroy {
	private _mediaProvider: MediaServiceProvider | null = null;
	private xosmsLog = this.logger.child("xosms");

	constructor(private app: App) {
		super("mediaController");
	}

	async BeforeStart() {
		try {
			app.commandLine.appendSwitch("disable-features", "MediaSessionService");
			app.commandLine.appendSwitch("in-progress-gpu");
		} catch (error) {
			this.logger.error("Failed to set command line switches:", error);
		}
	}

	private onKeyPressed(ev, keyName, ...args) {
		try {
			this.xosmsLog.debug(["button press", keyName, ...args]);
			const trackProvider = this.getProvider("api");
			if (!trackProvider) {
				this.logger.warn("API provider not available for media control");
				return;
			}

			switch (keyName) {
				case "pause":
					trackProvider.pauseTrack();
					break;
				case "play":
					trackProvider.playTrack();
					break;
				case "next":
					trackProvider.nextTrack();
					break;
				case "previous":
					trackProvider.prevTrack();
					break;
			}
		} catch (error) {
			this.logger.error("Error handling media key press:", error);
		}
	}

	private onPosChange(ev: any, pos: number) {
		try {
			this.logger.debug("onPosChange", pos);
			return this.api.seekTrack(null, {
				type: "seek",
				time: pos * 1000,
			});
		} catch (error) {
			this.logger.error("Error handling position change:", error);
		}
	}

	private onPosSeek(ev: any, seek: number) {
		try {
			this.logger.debug("onPosSeek", seek);
			return this.api.seekTrack(null, {
				time: seek * 1000,
			});
		} catch (error) {
			this.logger.error("Error handling position seek:", error);
		}
	}

	async AfterInit() {
		try {
			this._mediaProvider = new MediaServiceProvider(this.app.name, this.app.name);
			if (!this._mediaProvider) {
				throw new Error("Failed to create media provider");
			}

			this._mediaProvider.seekEnabled = true;
			this._mediaProvider.previousButtonEnabled = true;
			this._mediaProvider.nextButtonEnabled = true;

			this._mediaProvider.addEventListener("buttonpressed", this.onKeyPressed.bind(this));
			this._mediaProvider.addEventListener("positionchanged", this.onPosChange.bind(this));
			this._mediaProvider.addEventListener("positionseeked", this.onPosSeek.bind(this));

			await this._mediaProvider.activate();

			if (!this.mediaProviderEnabled()) {
				this.xosmsLog.warn("XOSMS is disabled", ":: Status:", `Provider: ${!!this._mediaProvider}, Enabled: ${this.mediaProviderEnabled()}`);
			}
		} catch (error) {
			this.logger.error("Failed to initialize media provider:", error);
			this._mediaProvider = null;
		}
	}

	get instance() {
		return this._mediaProvider;
	}

	get trackData() {
		return this.getProvider("track")?.trackData;
	}

	get api() {
		return this.getProvider("api");
	}

	@IpcOn(IPC_EVENT_NAMES.TRACK_PLAYSTATE)
	private __handleTrackMediaOSControl(_ev, isPlaying: boolean, progressSeconds: number = 0) {
		if (!this.mediaProviderEnabled()) return;

		try {
			const { trackData } = this.getProvider("track");
			if (!trackData) {
				this._mediaProvider!.playbackStatus = MediaPlayerPlaybackStatus.Stopped;
				this._mediaProvider!.playButtonEnabled = true;
				this._mediaProvider!.pauseButtonEnabled = false;
			} else {
				this._mediaProvider!.playbackStatus = isPlaying ? MediaPlayerPlaybackStatus.Playing : MediaPlayerPlaybackStatus.Paused;
				this._mediaProvider!.playButtonEnabled = !isPlaying;
				this._mediaProvider!.pauseButtonEnabled = isPlaying;

				const [progress, duration] = [progressSeconds, Number(this.trackData!.meta.duration)];
				this._mediaProvider!.setTimeline(duration, clamp(progress, 0, duration));
			}
			this._mediaProvider!.update();
		} catch (error) {
			this.logger.error("Error handling track media OS control:", error);
		}
	}

	private mediaProviderEnabled() {
		return !!this._mediaProvider;
	}

	async handleTrackMediaOSControlChange(trackData: TrackData) {
		if (!this.mediaProviderEnabled() || !trackData?.video) return;

		try {
			const albumThumbnail = trackData.meta.thumbnail;
			this._mediaProvider!.mediaType = MediaPlayerMediaType.Music;
			this._mediaProvider!.playbackStatus = MediaPlayerPlaybackStatus.Playing;
			this._mediaProvider!.artist = trackData.video.author;
			this._mediaProvider!.albumTitle = trackData.context.pageOwnerDetails.name;
			this._mediaProvider!.artist = trackData.video.author;

			if (albumThumbnail) {
				this._mediaProvider!.setThumbnail(await MediaPlayerThumbnail.create(MediaPlayerThumbnailType.Uri, albumThumbnail));
			}

			this._mediaProvider!.title = trackData.video.title;
			this._mediaProvider!.trackId = trackData.video.videoId;
			this._mediaProvider!.previousButtonEnabled = true;
			this._mediaProvider!.nextButtonEnabled = true;
			this._mediaProvider!.update();

			this.logger.debug(this._mediaProvider!.title, this._mediaProvider!.mediaType === 1 ? "music" : "other", this._mediaProvider!.trackId);
		} catch (error) {
			this.logger.error("Error handling track media control change:", error);
		}
	}

	OnDestroy(): void | Promise<void> {
		try {
			if (this._mediaProvider) {
				this._mediaProvider.removeEventListener("buttonpressed", this.onKeyPressed);
				this._mediaProvider.deactivate();
				this._mediaProvider = null;
			}
		} catch (error) {
			this.logger.error("Error during media provider cleanup:", error);
		}
	}
}
