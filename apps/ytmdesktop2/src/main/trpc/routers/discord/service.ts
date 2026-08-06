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
		options?: Partial<{ showButtons: boolean; showThumbnails: boolean }>,
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

	private _updateActivity(activity: DiscordActivity, options?: Partial<{ showButtons: boolean; showThumbnails: boolean }>) {
		if (!this.wantConnected || !this.settingsEnabled || !this.isConnected || !this.client) return;
		this.client.setActivity(this.applyActivityOptions(activity, options));
	}

	private updateActivity = debounce(this._updateActivity.bind(this), 1000);

	private pushCurrentTrack(immediate = false) {
		if (!this.wantConnected || !this.settingsEnabled || !this.isConnected) return;
		const track = trackService.trackData;
		if (!track) return;
		const embed = discordEmbedFromTrack(track, trackService.playing, trackService.trackState?.progress ?? 0);
		if (immediate) this._updateActivity(embed);
		else this.updateActivity(embed);
	}

	async disable() {
		// Gate first so close/error from destroy cannot schedule reconnect
		this.wantConnected = false;
		this.clearRetryTimer();
		this.connectionRetries = 0;
		this.updateActivity.cancel();

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
		this.settingsInstance.onSettingChange("discord.buttons", (value) => void this.__onToggleButtons(value as boolean), {
			debounce: 1000,
		});
		if (!this.settingsEnabled) return;
		// Do not await — Discord IPC retries must not block Promise.all AfterInit
		void this.enable().catch((err) => this.logger.error("Discord enable failed", err));
	}

	async updateTrackProgress(isPlaying: boolean, mediaProgress: number = 0, updateImmediate: boolean = false) {
		if (!this.wantConnected || !this.settingsEnabled || !this.isConnected || !trackService.trackData) return;
		const embed = discordEmbedFromTrack(trackService.trackData, isPlaying, mediaProgress);
		if (updateImmediate) this._updateActivity(embed);
		else this.updateActivity(embed);
	}

	private async __onToggleEnabled(enabled: boolean) {
		if (enabled) await this.enable();
		else await this.disable();
	}

	private async __onToggleButtons(buttons: boolean) {
		if (!this.wantConnected || !this.settingsEnabled || !trackService.trackData) return;
		const embed = discordEmbedFromTrack(trackService.trackData, trackService.playing, trackService.trackState?.progress ?? 0);
		if (!buttons) embed.buttons = [];
		this._updateActivity(embed, { showButtons: buttons });
	}

	getConnectedState() {
		return this.settingsEnabled && this.isConnected;
	}

	private async __onTrackInfo(track: TrackData) {
		if (!track?.video || !this.wantConnected || !this.settingsEnabled || !this.isConnected) return;
		this.updateActivity(discordEmbedFromTrack(track));
	}

	async OnDestroy() {
		await this.disable();
	}
}
