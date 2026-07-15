import { platform } from "@electron-toolkit/utils";
import { AfterInit, BaseProvider, OnDestroy } from "@main/utils/baseProvider";
import { IpcContext, IpcOn } from "@main/utils/onIpcEvent";
import { TrackData } from "@main/utils/trackData";
import { type App } from "electron";

let Player: any = null;

@IpcContext
export default class MprisProvider extends BaseProvider implements AfterInit, OnDestroy {
	private _player: any = null;
	private _enabled = false;
	private _reconnecting = false;
	private _lastPositionMicroseconds = 0;
	private _lastUpdated = Date.now();

	constructor(private app: App) {
		super("mpris");
	}

	private get settingsInstance() {
		return this.getProvider("settings");
	}

	private get apiProvider() {
		return this.getProvider("api");
	}

	private get trackService() {
		return this.getProvider("track");
	}

	private get mprisEnabled(): boolean {
		return !!this.settingsInstance?.get("player.mpris.enabled", true);
	}

	async AfterInit() {
		if (!platform.isLinux) return;

		try {
			if (!Player) {
				Player = (await import("mpris-service")).default;
			}
		} catch (err) {
			this.logger.error("mpris-service module not available:", err);
			return;
		}

		if (this.mprisEnabled) {
			await this.enable();
		}
	}

	async enable() {
		if (!platform.isLinux) return;
		if (this._player) return;

		try {
			if (!Player) {
				Player = (await import("mpris-service")).default;
			}

			this._player = Player({
				name: "ytmdesktop2",
				identity: "YouTube Music Desktop",
				supportedUriSchemes: ["https"],
				supportedMimeTypes: ["audio/mpeg"],
				supportedInterfaces: ["player"],
				canRaise: false,
				canQuit: true,
				desktopEntry: "ytmdesktop2",
			});

			this._player.on("error", (err: any) => {
				this.logger.error("MPRIS player internal error:", err);
				this.handleBusError(err);
			});

			this._player.playbackStatus = "Stopped";
			this._player.canGoNext = true;
			this._player.canGoPrevious = true;
			this._player.canPlay = true;
			this._player.canPause = true;
			this._player.canSeek = false;
			this._player.canControl = true;

			this._player.on("play", () => {
				try {
					this.apiProvider?.playTrack();
				} catch (err) {
					this.logger.error("MPRIS play error:", err);
				}
			});

			this._player.on("pause", () => {
				try {
					this.apiProvider?.pauseTrack();
				} catch (err) {
					this.logger.error("MPRIS pause error:", err);
				}
			});

			this._player.on("playpause", () => {
				try {
					this.apiProvider?.toggleTrackPlayback();
				} catch (err) {
					this.logger.error("MPRIS playpause error:", err);
				}
			});

			this._player.on("stop", () => {
				try {
					this.apiProvider?.pauseTrack();
				} catch (err) {
					this.logger.error("MPRIS stop error:", err);
				}
			});

			this._player.on("next", () => {
				try {
					this.apiProvider?.nextTrack();
				} catch (err) {
					this.logger.error("MPRIS next error:", err);
				}
			});

			this._player.on("previous", () => {
				try {
					this.apiProvider?.prevTrack();
				} catch (err) {
					this.logger.error("MPRIS previous error:", err);
				}
			});

			this._enabled = true;
			this.logger.debug("MPRIS service enabled");

			const track = this.trackService?.trackData;
			if (track) {
				await this.updateTrackMetadata(track);
			}

			const trackState = this.trackService?.trackState;
			if (trackState) {
				this.updatePlaybackStatus(trackState.playing);
				this.updatePosition(trackState.progress ?? 0);
			}
		} catch (err) {
			this.logger.error("Failed to enable MPRIS service:", err);
			this._player = null;
			this._enabled = false;
		}
	}

	disable() {
		try {
			if (this._player) {
				try {
					this._player.removeAllListeners();
				} catch {}
				try {
					if (this._player._bus) {
						this._player._bus.disconnect();
					}
				} catch {}
				this._player = null;
			}
		} catch (err) {
			this.logger.error("Failed to disable MPRIS service:", err);
		} finally {
			this._enabled = false;
		}
	}

	private async handleBusError(err: any) {
		if (this._reconnecting) return;
		this._reconnecting = true;
		this.logger.warn("DBus/MPRIS error detected, reconnecting in 200ms...", err?.message || err);
		this.disable();
		setTimeout(async () => {
			try {
				await this.enable();
			} catch (reconnectErr) {
				this.logger.error("Failed to reconnect MPRIS:", reconnectErr);
			} finally {
				this._reconnecting = false;
			}
		}, 200);
	}

	async updateTrackMetadata(trackData: TrackData) {
		if (!this._player) return;

		try {
			if (!trackData || !trackData.video) {
				this._player.metadata = {};
				this._player.playbackStatus = "Stopped";
				return;
			}

			const durationSeconds = Number(trackData.meta?.duration ?? 0);
			const durationMicroseconds = Math.floor(durationSeconds * 1e6);

			const artists = trackData.video.author ? [trackData.video.author] : [];
			const album = trackData.music?.album ?? trackData.context?.pageOwnerDetails?.name ?? "";
			const artUrl = trackData.meta?.thumbnail ?? "";
			const title = trackData.video.title ?? "";

			this._player.metadata = {
				"mpris:trackid": this._player.objectPath(`track/${trackData.video.videoId}`),
				"mpris:length": durationMicroseconds,
				"mpris:artUrl": artUrl,
				"xesam:title": title,
				"xesam:artist": artists,
				"xesam:album": album,
			};
		} catch (err) {
			this.logger.error("Failed to update MPRIS track metadata:", err);
			this.handleBusError(err);
		}
	}

	updatePlaybackStatus(isPlaying: boolean) {
		if (!this._player) return;

		try {
			this._player.playbackStatus = isPlaying ? "Playing" : "Paused";
			this._lastUpdated = Date.now();
		} catch (err) {
			this.logger.error("Failed to update MPRIS playback status:", err);
			this.handleBusError(err);
		}
	}

	updatePosition(progressSeconds: number) {
		if (!this._player) return;

		try {
			this._lastPositionMicroseconds = Math.floor(progressSeconds * 1e6);
			this._lastUpdated = Date.now();
			this._player.getPosition = () => {
				if (this._player && this._player.playbackStatus === "Playing") {
					return this._lastPositionMicroseconds + (Date.now() - this._lastUpdated) * 1000;
				}
				return this._lastPositionMicroseconds;
			};
		} catch (err) {
			this.logger.error("Failed to update MPRIS position:", err);
			this.handleBusError(err);
		}
	}

	@IpcOn("settingsProvider.change", {
		filter: (key: string) => key === "player.mpris.enabled",
		debounce: 500,
	})
	private async __onToggleMpris(_key: string, enabled: boolean) {
		if (enabled) {
			await this.enable();
		} else {
			this.disable();
		}
	}

	OnDestroy(): void | Promise<void> {
		this.disable();
	}
}
