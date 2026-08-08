import { AfterInit, BaseProvider, BeforeStart, OnDestroy } from "@main/core/baseProvider";
import { type TrackState, trackService } from "@main/trpc/routers/track";
import { TrackData } from "@shared/track/trackData";
import { MediaPlayerMediaType, MediaPlayerPlaybackStatus, MediaPlayerThumbnail, MediaPlayerThumbnailType, MediaPlayer as MediaServiceProvider } from "@venipa/xosms";
import { type App, app } from "electron";
import { clamp } from "lodash-es";

/**
 * Stable MPRIS D-Bus instance name → `org.mpris.MediaPlayer2.ytmdesktop2`.
 * Must match Flatpak `--own-name` and Snap `mpris` slot name.
 * Do not use productName/`app.name` (spaces → `YouTube_Music_for_Desktop`) — sandboxes deny that bind.
 */
const MPRIS_SERVICE_NAME = "ytmdesktop2";

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

	/**
	 * Apply a batch of MediaPlayer mutations, then flush once.
	 * Linux MPRIS only publishes PropertiesChanged on `update()` — setters only queue.
	 * Keep this path on Windows/macOS too (noop-safe there).
	 */
	private syncOsMediaPlayer(apply: (player: MediaServiceProvider) => void): void {
		if (!this._mediaProvider) return;
		try {
			apply(this._mediaProvider);
			this._mediaProvider.update();
		} catch (error) {
			this.logger.error("Error syncing OS media player:", error);
		}
	}

	async AfterInit() {
		try {
			// serviceName = D-Bus suffix; identity = human-readable MPRIS Identity (playerctl / DE UI)
			this._mediaProvider = new MediaServiceProvider(MPRIS_SERVICE_NAME, this.app.name);

			this._mediaProvider.addEventListener("buttonpressed", this.onKeyPressedBound);
			this._mediaProvider.addEventListener("positionchanged", this.onPosChangeBound);
			this._mediaProvider.addEventListener("positionseeked", this.onPosSeekBound);

			this._mediaProvider.activate();
			this.xosmsLog.debug(`activated org.mpris.MediaPlayer2.${MPRIS_SERVICE_NAME}`);

			// Buttons must be enabled + flushed before playerctl play/pause works.
			// macOS NowPlaying Toggle also needs can_play || can_pause (defaults false).
			this.syncOsMediaPlayer((player) => {
				player.playButtonEnabled = true;
				player.pauseButtonEnabled = true;
				player.seekEnabled = true;
				player.previousButtonEnabled = true;
				player.nextButtonEnabled = true;
			});

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

		this.syncOsMediaPlayer((player) => {
			const trackData = trackService.trackData;
			const isPlaying = !!state.playing;

			if (!trackData || !state.id) {
				player.playbackStatus = MediaPlayerPlaybackStatus.Stopped;
				player.playButtonEnabled = true;
				player.pauseButtonEnabled = false;
				return;
			}

			player.playbackStatus = isPlaying ? MediaPlayerPlaybackStatus.Playing : MediaPlayerPlaybackStatus.Paused;
			player.playButtonEnabled = !isPlaying;
			player.pauseButtonEnabled = isPlaying;

			const duration = Number(state.duration || trackData.meta?.duration || 0);
			const progress = Number(state.progress ?? state.uiProgress ?? 0);
			if (duration > 0) {
				// Completes xosms track transition so SetPosition scrub events are accepted
				player.setTimeline(duration, clamp(progress, 0, duration));
			}
		});
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

			// Resolve thumbnail before the sync batch so one update() covers metadata + art + timeline.
			const thumbnail = albumThumbnail
				? await MediaPlayerThumbnail.create(MediaPlayerThumbnailType.Uri, albumThumbnail)
				: null;

			if (!this.mediaProviderEnabled()) return;

			this.syncOsMediaPlayer((player) => {
				player.mediaType = MediaPlayerMediaType.Music;
				player.playbackStatus = playing ? MediaPlayerPlaybackStatus.Playing : MediaPlayerPlaybackStatus.Paused;
				player.artist = trackData.video.author ?? "";
				player.albumTitle = albumTitle;
				player.playButtonEnabled = !playing;
				player.pauseButtonEnabled = playing;
				player.title = trackData.video.title;
				player.trackId = trackData.video.videoId;
				player.previousButtonEnabled = true;
				player.nextButtonEnabled = true;
				player.seekEnabled = true;

				if (thumbnail) {
					player.setThumbnail(thumbnail);
				}

				// trackId bumps revision + zeros duration; setTimeline must land in same flush
				if (duration > 0) {
					player.setTimeline(duration, clamp(progress, 0, duration));
				}
			});

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
