import { AfterInit, BaseProvider, BeforeStart, OnDestroy } from "@main/core/baseProvider";
import { type TrackState, trackService } from "@main/trpc/routers/track";
import { TrackData } from "@shared/track/trackData";
import { type App } from "electron";
import { clamp } from "lodash-es";
import { type ButtonPressedType, MediaPlayer, MediaPlayerThumbnail } from "xosms";

/**
 * Stable MPRIS D-Bus instance name -> `org.mpris.MediaPlayer2.ytmdesktop2`.
 * Must match Flatpak `--own-name=org.mpris.MediaPlayer2.ytmdesktop2`.
 * Do not use productName/`app.name` (spaces -> `YouTube_Music_for_Desktop`) - sandboxes deny that bind.
 */
const MPRIS_SERVICE_NAME = "ytmdesktop2";

export default class MediaControlProvider extends BaseProvider implements AfterInit, BeforeStart, OnDestroy {
	private _mediaProvider: MediaPlayer | null = null;
	private xosmsLog = this.logger.child("xosms");
	private disposeSubscriptions: (() => void)[] = [];

	constructor(private app: App) {
		super("mediaController");
	}

	async BeforeStart() {}

	private async onKeyPressed(keyName: ButtonPressedType) {
		this.xosmsLog.debug(["button press", keyName]);
		try {
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
				default: {
					const unhandled: never = keyName;
					this.xosmsLog.warn("Unhandled media button", unhandled);
				}
			}
		} catch (error) {
			this.logger.error("Error handling media key press:", error);
		}
	}

	private async onPosChange(pos: number) {
		try {
			this.logger.debug("onPosChange", pos);
			await trackService.seekTrack(undefined, {
				type: "seek",
				time: pos * 1000,
			});
		} catch (error) {
			this.logger.error("Error handling position change:", error);
		}
	}

	private async onPosSeek(seek: number) {
		try {
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
	 * Linux MPRIS only publishes PropertiesChanged on `update()` - setters only queue.
	 * `setTimeline` pushes immediately, so it runs after `update()`.
	 */
	private async syncOsMediaPlayer(
		apply: (player: MediaPlayer) => void,
		timeline?: { duration: number; position: number },
	): Promise<void> {
		if (!this._mediaProvider) return;
		try {
			apply(this._mediaProvider);
			await this._mediaProvider.update();
			if (timeline) {
				await this._mediaProvider.setTimeline(timeline.duration, timeline.position);
			}
		} catch (error) {
			this.logger.error("Error syncing OS media player:", error);
		}
	}

	async AfterInit() {
		try {
			// serviceName = D-Bus suffix; identity = human-readable MPRIS Identity (playerctl / DE UI)
			this._mediaProvider = new MediaPlayer(MPRIS_SERVICE_NAME, this.app.name);

			this._mediaProvider.setButtonPressedCallback((button) => this.onKeyPressed(button));
			this._mediaProvider.setPositionChangedCallback((position) => this.onPosChange(position));
			this._mediaProvider.setPositionSeekedCallback((offset) => this.onPosSeek(offset));

			await this._mediaProvider.activate();
			this.xosmsLog.debug(`activated org.mpris.MediaPlayer2.${MPRIS_SERVICE_NAME}`);

			// Buttons must be enabled + flushed before playerctl play/pause works.
			// macOS NowPlaying Toggle also needs can_play || can_pause (defaults false).
			await this.syncOsMediaPlayer((player) => {
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
					void this.applyTrackState(state);
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

	private async applyTrackState(state: TrackState) {
		if (!this.mediaProviderEnabled()) return;

		const trackData = trackService.trackData;
		const hasTrack = !!trackData && !!state.id;
		const isPlaying = !!state.playing;
		const duration = hasTrack ? Number(state.duration || trackData.meta?.duration || 0) : 0;
		const progress = hasTrack ? Number(state.progress ?? state.uiProgress ?? 0) : 0;
		const timeline = hasTrack && duration > 0 ? { duration, position: clamp(progress, 0, duration) } : undefined;

		await this.syncOsMediaPlayer((player) => {
			if (!hasTrack) {
				player.playbackStatus = "stopped";
				player.playButtonEnabled = true;
				player.pauseButtonEnabled = false;
				return;
			}

			player.playbackStatus = isPlaying ? "playing" : "paused";
			// MPRIS CanPlay/CanPause = command allowed, not exclusive UI. playerctl play-pause needs both.
			player.playButtonEnabled = true;
			player.pauseButtonEnabled = true;
		}, timeline);
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

			const thumbnail = albumThumbnail ? await MediaPlayerThumbnail.create("uri", albumThumbnail) : null;

			if (!this.mediaProviderEnabled()) return;

			const timeline = duration > 0 ? { duration, position: clamp(progress, 0, duration) } : undefined;

			await this.syncOsMediaPlayer((player) => {
				player.playbackStatus = playing ? "playing" : "paused";
				player.artist = trackData.video.author ? [trackData.video.author] : [];
				player.albumTitle = albumTitle;
				player.playButtonEnabled = true;
				player.pauseButtonEnabled = true;
				player.title = trackData.video.title;
				player.trackId = trackData.video.videoId;
				player.previousButtonEnabled = true;
				player.nextButtonEnabled = true;
				player.seekEnabled = true;

				if (thumbnail) {
					player.thumbnail = thumbnail;
				}
			}, timeline);

			this.logger.debug(this._mediaProvider!.title, this._mediaProvider!.trackId);
		} catch (error) {
			this.logger.error("Error handling track media control change:", error);
		}
	}

	async OnDestroy(): Promise<void> {
		try {
			this.disposeSubscriptions.forEach((dispose) => dispose());
			this.disposeSubscriptions = [];
			if (this._mediaProvider) {
				await this._mediaProvider.deactivate();
				this._mediaProvider.dispose();
				this._mediaProvider = null;
			}
		} catch (error) {
			this.logger.error("Error during media provider cleanup:", error);
		}
	}
}
