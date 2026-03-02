import DiscordClient from "@main/lib/discord-rpc";
import { type DiscordActivity, DiscordActivityStatusDisplayType, DiscordActivityType } from "@main/lib/discord-rpc/discord-rpc";
import { AfterInit, BaseProvider, OnDestroy } from "@main/utils/baseProvider";
import { IpcContext, IpcHandle, IpcOn } from "@main/utils/onIpcEvent";
import { discordEmbedFromTrack, TrackData } from "@main/utils/trackData";
import translations from "@translations/index";
import { type App } from "electron";
import { debounce } from "lodash-es";

const DISCORD_UPDATE_INTERVAL = 1000 * 15;
const DEFAULT_PRESENCE: DiscordActivity = {
	assets: {
		large_image: "logo",
		large_text: translations.appName,
	},
	status_display_type: DiscordActivityStatusDisplayType.Name,
	type: DiscordActivityType.Listening,
	buttons: [],
};
const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
const DISCORD_SERVICE_ENABLED = !!CLIENT_ID;
@IpcContext
export default class DiscordProvider extends BaseProvider implements AfterInit, OnDestroy {
	private rpcManager: DiscordClient;
	private _enabled = !!DISCORD_SERVICE_ENABLED;

	constructor(private app: App) {
		super("discord");
		this.rpcManager = new DiscordClient(CLIENT_ID);
	}

	get isConnected() {
		return this.rpcManager.isConnected;
	}

	get enabled() {
		return this._enabled;
	}

	get presence() {
		return this.rpcManager.presence;
	}

	private get settingsInstance() {
		return this.getProvider("settings");
	}

	private get trackService() {
		return this.getProvider("track");
	}

	private connectionRetries = 0;
	private maxConnectionRetries = 30;
	private connectionRetryTimeout: NodeJS.Timeout | null = null;
	private connectionPromise: Promise<void> | null = null;
	private tryConnect(): Promise<void> {
		if (this.connectionPromise) return this.connectionPromise;
		if (this.isConnected) {
			this.windowContext.sendToAllViews("discord.connected");
			return Promise.resolve();
		}
		this.connectionPromise = new Promise<void>((resolve, reject) => {
			this.logger.info(`Connecting to Discord attempt ${this.connectionRetries}/${this.maxConnectionRetries}`);
			if (this.enabled) {
				this.windowContext.sendToAllViews("discord.loading");
				if (this.connectionRetries < this.maxConnectionRetries) {
					this.connectionRetries++;
					this.connectionRetryTimeout = setTimeout(() => {
						if (this.rpcManager) {
							this.rpcManager
								.connect()
								.then(resolve)
								.catch(() => {
									this.connectionPromise = null; // reset the promise to allow for a new connection attempt
									return this.tryConnect(); // try to connect again
								});
						}
					}, 5 * 1000);
				} else {
					const errorMessage = `Failed to connect to Discord after ${this.maxConnectionRetries} attempts`;
					this.connectionRetries = 0;
					this.connectionRetryTimeout = null;
					this.connectionPromise = null;
					this.windowContext.sendToAllViews("discord.error", errorMessage);
					this.logger.error(errorMessage);
					reject(new Error(errorMessage));
				}
			} else {
				const errorMessage = "Discord is not enabled";
				this.connectionRetries = 0;
				this.connectionRetryTimeout = null;
				this.connectionPromise = null;
				this.logger.warn(errorMessage);
				resolve();
			}
		}).finally(() => {
			// remove the promise from the memory after it's resolved or rejected
			if (this.isConnected) this.windowContext.sendToAllViews("discord.connected");
			else this.windowContext.sendToAllViews("discord.disconnected");
			this.connectionPromise = null;
		});
		this.rpcManager.once("close", () => {
			if (this.connectionPromise) return;
			this.windowContext.sendToAllViews("discord.disconnected");
			this.enable();
		});
		this.rpcManager.once("error", (error) => {
			this.logger.error("Discord error", error);
			if (this.connectionPromise) return;
			this.windowContext.sendToAllViews("discord.disconnected");
			this.enable();
		});
		return this.connectionPromise;
	}
	private _updateActivity = (activity: DiscordActivity, options?: Partial<{ showButtons?: boolean; showThumbnails?: boolean }>) => {
		if (!this.isConnected) {
			if (!this.connectionPromise) this.tryConnect(); // try to connect to Discord if not connected :: investigating, potential discord issue instead of my code
			throw new Error("Discord is not connected");
		}
		if (!options)
			options = {
				showButtons: this.settingsInstance.get("discord.buttons", true),
				showThumbnails: this.settingsInstance.get("discord.thumbnails", true),
			};
		else {
			const newOptions = Object.assign(
				{},
				{
					showButtons: this.settingsInstance.get("discord.buttons", true),
					showThumbnails: this.settingsInstance.get("discord.thumbnails", true),
				},
				options,
			) as typeof options;
			options = newOptions;
		}

		if (options.showButtons === false) {
			activity.buttons = [];
		}
		if (options.showThumbnails === false) {
			if (!activity.assets)
				Object.assign(activity.assets, {
					large_image: "logo",
					large_text: translations.appName,
				});
			else activity.assets.large_image = "logo";
		}
		this.rpcManager.setActivity(activity);
	};
	private updateActivity = debounce(this._updateActivity, 1000);
	get settingsEnabled() {
		return !!this.settingsInstance.get("discord.enabled", false);
	}

	async disable() {
		this.rpcManager.clearActivity();
		this.rpcManager.destroy();

		this.windowContext.sendToAllViews("discord.disconnected");
	}

	async enable() {
		await this.tryConnect();
		if (this.trackService.trackData) {
			const { trackData: track, playing, trackState } = this.trackService;
			if (track) {
				this.updateActivity(discordEmbedFromTrack(track, playing, trackState?.progress ?? 0));
			}
		}
	}

	async AfterInit() {
		const settings = this.settingsInstance.instance;
		if (!settings.discord.enabled || !this._enabled) return;
		await this.enable();
	}

	async updateTrackProgress(isPlaying: boolean, mediaProgress: number = 0, updateImmediate: boolean = false) {
		if (this.trackService.trackData && this.isConnected) {
			if (updateImmediate) this._updateActivity(discordEmbedFromTrack(this.trackService.trackData, isPlaying, mediaProgress));
			else this.updateActivity(discordEmbedFromTrack(this.trackService.trackData, isPlaying, mediaProgress));
		}
	}

	@IpcOn("settingsProvider.change", {
		filter: (key: string) => key === "discord.enabled",
		debounce: 1000,
	})
	private async __onToggleEnabled(key: string, enabled: boolean) {
		if (enabled) {
			await this.enable();
		} else {
			await this.disable();
		}
	}

	@IpcOn("settingsProvider.change", {
		filter: (key: string) => key === "discord.buttons",
		debounce: 1000,
	})
	private async __onToggleButtons(key: string, buttons: boolean) {
		if (this.trackService.trackData) {
			const { trackData: track, playing, trackState } = this.trackService;
			if (track) {
				const embed = discordEmbedFromTrack(track, playing, trackState?.progress ?? 0);
				if (!buttons) embed.buttons = [];
				this.updateActivity(embed);
			}
		}
	}

	@IpcHandle("req:discord.connected")
	private async handleDiscordState() {
		return DISCORD_SERVICE_ENABLED && this.enabled && this.isConnected;
	}

	@IpcOn("track:change", {
		debounce: 1000,
	})
	private async __onTrackInfo(track: TrackData) {
		if (!track?.video) return;
		this.updateActivity(discordEmbedFromTrack(track));
	}

	async OnDestroy() {
		await this.disable();
	}
}
