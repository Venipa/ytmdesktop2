import { AfterInit, BaseProvider, BeforeStart, OnDestroy } from "@main/core/baseProvider";
import { type TrackState, trackService } from "@main/trpc/routers/track";
import { TrackData } from "@shared/track/trackData";
import { MediaPlayerMediaType, MediaPlayerPlaybackStatus, MediaPlayerThumbnail, MediaPlayerThumbnailType, MediaPlayer as MediaServiceProvider } from "@venipa/xosms";
import { type App, app } from "electron";
import { clamp } from "lodash-es";

export default class MediaControlProvider extends BaseProvider implements AfterInit, BeforeStart, OnDestroy {
	private _mediaProvider: MediaServiceProvider | null = null;
	private xosmsLog = this.logger.child("xosms");
	private disposeSubscriptions: (() => void)[] = [];
	private readonly onKeyPressedBound = this.onKeyPressed.bind(this);
	private readonly onPosChangeBound = this.onPosChange.bind(this);
	private readonly onPosSeekBound = this.onPosSeek.bind(this);

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

	/** xosms CalleeHandled: `(err, button)` */
	private onKeyPressed(err: Error | null, keyName: string) {
		try {
			if (err) {
				this.logger.error("xosms buttonpressed error:", err);
				return;
			}
			this.xosmsLog.debug(["button press", keyName]);

			const run = async () => {
				switch (keyName) {
					case "playpause":
						await trackService.toggleTrackPlayback();
						break;
					case "pause":
					case "stop":
						await trackService.pauseTrack();
						break;
					case "play":
						await trackService.playTrack();
						break;
					case "next":
						await trackService.nextTrack();
						break;
					case "previous":
						await trackService.prevTrack();
						break;
					default:
						this.xosmsLog.warn("Unhandled media button", keyName);
				}
			};
			void run().catch((error) => this.logger.error("Error handling media key press:", error));
		} catch (error) {
			this.logger.error("Error handling media key press:", error);
		}
	}

	/** xosms CalleeHandled: `(err, positionSeconds)` — absolute */
	private async onPosChange(err: Error | null, pos: number) {
		try {
			if (err) {
				this.logger.error("xosms positionchanged error:", err);
				return;
			}
			this.logger.debug("onPosChange", pos);
			await trackService.seekTrack(undefined, {
				type: "seek",
				time: pos * 1000,
			});
		} catch (error) {
			this.logger.error("Error handling position change:", error);
		}
	}

	/** xosms CalleeHandled: `(err, seekDeltaSeconds)` — relative */
	private async onPosSeek(err: Error | null, seek: number) {
		try {
			if (err) {
				this.logger.error("xosms positionseeked error:", err);
				return;
			}
			this.logger.debug("onPosSeek", seek);
			await trackService.seekTrack(undefined, {
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

			// macOS NowPlaying Toggle requires can_play || can_pause — defaults are false.
			this._mediaProvider.playButtonEnabled = true;
			this._mediaProvider.pauseButtonEnabled = true;
			this._mediaProvider.seekEnabled = true;
			this._mediaProvider.previousButtonEnabled = true;
			this._mediaProvider.nextButtonEnabled = true;

			this._mediaProvider.addEventListener("buttonpressed", this.onKeyPressedBound);
			this._mediaProvider.addEventListener("positionchanged", this.onPosChangeBound);
			this._mediaProvider.addEventListener("positionseeked", this.onPosSeekBound);

			await this._mediaProvider.activate();

			if (!this.mediaProviderEnabled()) {
				this.xosmsLog.warn("XOSMS is disabled", ":: Status:", `Provider: ${!!this._mediaProvider}, Enabled: ${this.mediaProviderEnabled()}`);
			}

			this.disposeSubscriptions.push(
				trackService.onTrackChange((track) => {
					void this.handleTrackMediaOSControlChange(track);
				}),
				trackService.onTrackStateChange((state) => {
					this.applyTrackState(state);
				}, { immediate: true }),
			);
		} catch (error) {
			this.logger.error("Failed to initialize media provider:", error);
			this._mediaProvider = null;
		}
	}

	get instance() {
		return this._mediaProvider;
	}

	get trackData() {
		return trackService.trackData;
	}

	private applyTrackState(state: TrackState) {
		if (!this.mediaProviderEnabled()) return;

		try {
			const trackData = trackService.trackData;
			const isPlaying = !!state.playing;

			if (!trackData || !state.id) {
				this._mediaProvider!.playbackStatus = MediaPlayerPlaybackStatus.Stopped;
				this._mediaProvider!.playButtonEnabled = true;
				this._mediaProvider!.pauseButtonEnabled = false;
			} else {
				this._mediaProvider!.playbackStatus = isPlaying ? MediaPlayerPlaybackStatus.Playing : MediaPlayerPlaybackStatus.Paused;
				this._mediaProvider!.playButtonEnabled = !isPlaying;
				this._mediaProvider!.pauseButtonEnabled = isPlaying;

				const duration = Number(state.duration || trackData.meta?.duration || 0);
				const progress = Number(state.progress ?? state.uiProgress ?? 0);
				if (duration > 0) {
					// Completes xosms track transition so SetPosition scrub events are accepted
					this._mediaProvider!.setTimeline(duration, clamp(progress, 0, duration));
				}
			}
			this._mediaProvider!.update();
		} catch (error) {
			this.logger.error("Error applying track state to OS media controls:", error);
		}
	}

	private mediaProviderEnabled() {
		return !!this._mediaProvider;
	}

	async handleTrackMediaOSControlChange(trackData: TrackData) {
		if (!this.mediaProviderEnabled() || !trackData?.video) return;

		try {
			const albumThumbnail = trackData.meta?.thumbnail;
			const albumTitle = trackData.context?.pageOwnerDetails?.name || trackData.music?.album || "";
			const playing = trackService.playing;
			const duration = Number(trackData.meta?.duration || 0);
			const progress = Number(trackService.trackState?.progress ?? 0);

			this._mediaProvider!.mediaType = MediaPlayerMediaType.Music;
			this._mediaProvider!.playbackStatus = playing ? MediaPlayerPlaybackStatus.Playing : MediaPlayerPlaybackStatus.Paused;
			this._mediaProvider!.artist = trackData.video.author ?? "";
			this._mediaProvider!.albumTitle = albumTitle;
			this._mediaProvider!.playButtonEnabled = !playing;
			this._mediaProvider!.pauseButtonEnabled = playing;

			if (albumThumbnail) {
				this._mediaProvider!.setThumbnail(await MediaPlayerThumbnail.create(MediaPlayerThumbnailType.Uri, albumThumbnail));
			}

			this._mediaProvider!.title = trackData.video.title;
			this._mediaProvider!.trackId = trackData.video.videoId;
			this._mediaProvider!.previousButtonEnabled = true;
			this._mediaProvider!.nextButtonEnabled = true;
			this._mediaProvider!.seekEnabled = true;
			this._mediaProvider!.update();

			// trackId bumps revision + zeros duration; setTimeline unlocks scrub acceptance
			if (duration > 0) {
				this._mediaProvider!.setTimeline(duration, clamp(progress, 0, duration));
			}

			this.logger.debug(this._mediaProvider!.title, this._mediaProvider!.mediaType === 1 ? "music" : "other", this._mediaProvider!.trackId);
		} catch (error) {
			this.logger.error("Error handling track media control change:", error);
		}
	}

	OnDestroy(): void | Promise<void> {
		try {
			this.disposeSubscriptions.forEach((dispose) => dispose());
			this.disposeSubscriptions = [];
			if (this._mediaProvider) {
				this._mediaProvider.removeEventListener("buttonpressed", this.onKeyPressedBound);
				this._mediaProvider.removeEventListener("positionchanged", this.onPosChangeBound);
				this._mediaProvider.removeEventListener("positionseeked", this.onPosSeekBound);
				this._mediaProvider.deactivate();
				this._mediaProvider = null;
			}
		} catch (error) {
			this.logger.error("Error during media provider cleanup:", error);
		}
	}
}
