import { AfterInit, BaseProvider, OnDestroy } from "@main/core/baseProvider";
import DiscordClient from "@main/lib/discord-rpc";
import { type DiscordActivity } from "@main/lib/discord-rpc/discord-rpc";
import { discordEmbedFromTrack } from "@main/lib/discord-rpc/embedFromTrack";
import { trackService } from "@main/trpc/routers/track";
import type { TrackData } from "@shared/track/trackData";
import translations from "@translations/index";
import { type App } from "electron";
import { debounce } from "lodash-es";

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
const DISCORD_AVAILABLE = !!CLIENT_ID;
const CONNECT_RETRY_MS = 5_000;
const MAX_CONNECTION_RETRIES = 30;
/** Paused this long -> presence cleared until playback resumes. */
const IDLE_CLEAR_MS = 150_000;

type ActivityOptions = Partial<{ showButtons: boolean; showThumbnails: boolean }>;

export default class DiscordProvider extends BaseProvider implements AfterInit, OnDestroy {
	/** User/settings want presence active. Cleared on disable — blocks reconnect. */
	private wantConnected = false;
	private client: DiscordClient | null = null;
	private connectionRetries = 0;
	private retryTimer: NodeJS.Timeout | null = null;
	private connectPromise: Promise<boolean> | null = null;

	constructor(private app: App) {
		super("discord");
	}

	get isAvailable() {
		return DISCORD_AVAILABLE;
	}

	get isConnected() {
		return !!this.client?.isConnected;
	}

	/** Env + settings: Discord feature is on. */
	get settingsEnabled() {
		return this.isAvailable && !!this.settingsInstance.get("discord.enabled", false);
	}

	/** Alias for tray / callers that historically used `enabled`. */
	get enabled() {
		return this.settingsEnabled;
	}

	get presence() {
		return this.client?.presence;
	}

	private get settingsInstance() {
		return this.getProvider("settings");
	}

	private clearRetryTimer() {
		if (this.retryTimer) {
			clearTimeout(this.retryTimer);
			this.retryTimer = null;
		}
	}

	private createClient() {
		if (this.client) {
			this.client.removeAllListeners();
			this.client.destroy();
			this.client = null;
		}
		const next = new DiscordClient(CLIENT_ID);
		next.on("close", () => this.handleUnexpectedDisconnect());
		next.on("error", (error) => {
			this.logger.error("Discord error", error);
			this.handleUnexpectedDisconnect();
		});
		this.client = next;
		return next;
	}

	private handleUnexpectedDisconnect() {
		this.windowContext.sendToAllViews("discord.disconnected");
		if (!this.wantConnected || !this.settingsEnabled) return;
		this.scheduleReconnect();
	}

	private scheduleReconnect() {
		if (!this.wantConnected || !this.settingsEnabled) return;
		if (this.retryTimer || this.connectPromise) return;
		if (this.connectionRetries >= MAX_CONNECTION_RETRIES) {
			const errorMessage = `Failed to connect to Discord after ${MAX_CONNECTION_RETRIES} attempts`;
			this.logger.error(errorMessage);
			this.windowContext.sendToAllViews("discord.error", errorMessage);
			this.connectionRetries = 0;
			return;
		}
		this.retryTimer = setTimeout(() => {
			this.retryTimer = null;
			if (!this.wantConnected || !this.settingsEnabled) return;
			void this.connect().catch((err) => this.logger.error("Discord reconnect failed", err));
		}, CONNECT_RETRY_MS);
	}

	private async connect(): Promise<boolean> {
		if (!this.wantConnected || !this.settingsEnabled) return false;
		if (this.isConnected) {
			this.windowContext.sendToAllViews("discord.connected");
			return true;
		}
		if (this.connectPromise) return this.connectPromise;

		this.connectPromise = (async () => {
			this.windowContext.sendToAllViews("discord.loading");
			this.connectionRetries++;
			this.logger.info(`Connecting to Discord attempt ${this.connectionRetries}/${MAX_CONNECTION_RETRIES}`);

			const client = this.createClient();
			try {
				await client.connect();
				if (!this.wantConnected || !this.settingsEnabled) {
					client.removeAllListeners();
					client.destroy();
					if (this.client === client) this.client = null;
					this.windowContext.sendToAllViews("discord.disconnected");
					return false;
				}
				this.connectionRetries = 0;
				this.windowContext.sendToAllViews("discord.connected");
				return true;
			} catch (error) {
				this.logger.warn("Discord connect failed", error);
				if (this.wantConnected && this.settingsEnabled) {
					this.scheduleReconnect();
				} else {
					this.windowContext.sendToAllViews("discord.disconnected");
				}
				return false;
			}
		})().finally(() => {
			this.connectPromise = null;
		});

		return this.connectPromise;
	}

	private applyActivityOptions(
		activity: DiscordActivity,
		options?: ActivityOptions,
	): DiscordActivity {
		const showButtons = options?.showButtons ?? this.settingsInstance.get("discord.buttons", true);
		const showThumbnails = options?.showThumbnails ?? this.settingsInstance.get("discord.thumbnails", true);

		if (showButtons === false) {
			delete activity.buttons;
		}
		if (showThumbnails === false) {
			if (!activity.assets) {
				activity.assets = {
					large_image: "logo",
					large_text: translations.appName,
				};
			} else {
				activity.assets.large_image = "logo";
			}
		}
		return activity;
	}

	private lastSentPlaying: boolean | null = null;
	private idleTimer: NodeJS.Timeout | null = null;
	/** Presence was cleared after a long pause; stays cleared until playback resumes. */
	private idleCleared = false;

	private clearIdleTimer() {
		if (this.idleTimer) {
			clearTimeout(this.idleTimer);
			this.idleTimer = null;
		}
	}

	/** Paused presence has no timestamps, so Discord counts elapsed time forever — drop it after a while. */
	private trackIdle(playing: boolean) {
		if (playing) {
			this.clearIdleTimer();
			this.idleCleared = false;
			return;
		}
		if (this.idleTimer || this.idleCleared) return;
		this.idleTimer = setTimeout(() => {
			this.idleTimer = null;
			this.idleCleared = true;
			this.updateActivity.cancel();
			this.client?.clearActivity();
		}, IDLE_CLEAR_MS);
	}

	private _updateActivity(activity: DiscordActivity, options?: ActivityOptions) {
		if (!this.wantConnected || !this.settingsEnabled || !this.isConnected || !this.client) return;
		this.updateActivity.cancel();
		this.client.setActivity(this.applyActivityOptions(activity, options));
	}

	private updateActivity = debounce(this._updateActivity.bind(this), 1000);

	/** Single entry for every presence update; immediate on play/pause flips. */
	private publish(track: TrackData, playing: boolean, progress: number, immediate = false, options?: ActivityOptions) {
		if (!this.wantConnected || !this.settingsEnabled || !this.isConnected) return;
		this.trackIdle(playing);
		if (this.idleCleared) return;
		const embed = discordEmbedFromTrack(track, playing, progress);
		const playingChanged = this.lastSentPlaying !== playing;
		this.lastSentPlaying = playing;
		if (immediate || playingChanged) this._updateActivity(embed, options);
		else this.updateActivity(embed);
	}

	private pushCurrentTrack(immediate = false, options?: ActivityOptions) {
		const track = trackService.trackData;
		if (!track?.video) return;
		this.publish(track, trackService.playing, trackService.trackState?.progress ?? 0, immediate, options);
	}

	async disable() {
		// Gate first so close/error from destroy cannot schedule reconnect
		this.wantConnected = false;
		this.clearRetryTimer();
		this.clearIdleTimer();
		this.idleCleared = false;
		this.connectionRetries = 0;
		this.updateActivity.cancel();
		this.lastSentPlaying = null;

		try {
			if (this.client) {
				this.client.clearActivity();
				this.client.removeAllListeners();
				this.client.destroy();
				this.client = null;
			}
		} catch (error) {
			this.logger.error("Error disabling Discord", error);
		} finally {
			this.windowContext.sendToAllViews("discord.disconnected");
		}
	}

	async enable() {
		if (!this.settingsEnabled) return;
		this.wantConnected = true;
		this.connectionRetries = 0;
		// Drain aborting in-flight connect before starting a fresh one
		if (this.connectPromise) await this.connectPromise.catch(() => false);
		if (!this.wantConnected || !this.settingsEnabled) return;
		const ok = await this.connect();
		if (ok) this.pushCurrentTrack(true);
	}

	async AfterInit() {
		trackService.onTrackChange((track) => void this.__onTrackInfo(track), { debounce: 1000 });
		// No debounce on enabled — disable must stop loading/reconnect immediately
		this.settingsInstance.onSettingChange("discord.enabled", (value) => void this.__onToggleEnabled(value as boolean));
		this.settingsInstance.onSettingChange("discord.buttons", (value) => this.pushCurrentTrack(true, { showButtons: value as boolean }), {
			debounce: 1000,
		});
		this.settingsInstance.onSettingChange("discord.thumbnails", (value) => this.pushCurrentTrack(true, { showThumbnails: value as boolean }), {
			debounce: 1000,
		});
		if (!this.settingsEnabled) return;
		// Do not await — Discord IPC retries must not block Promise.all AfterInit
		void this.enable().catch((err) => this.logger.error("Discord enable failed", err));
	}

	async updateTrackProgress(isPlaying: boolean, mediaProgress: number = 0, updateImmediate: boolean = false) {
		if (!trackService.trackData) return;
		this.publish(trackService.trackData, isPlaying, mediaProgress, updateImmediate);
	}

	private async __onToggleEnabled(enabled: boolean) {
		if (enabled) await this.enable();
		else await this.disable();
	}

	getConnectedState() {
		return this.settingsEnabled && this.isConnected;
	}

	private async __onTrackInfo(track: TrackData) {
		if (!track?.video) return;
		this.publish(track, trackService.playing, trackService.trackState?.progress ?? 0, true);
	}

	async OnDestroy() {
		await this.disable();
	}
}
