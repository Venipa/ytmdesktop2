import DiscordClient from "@main/lib/discord-rpc";
import { AfterInit, BaseProvider } from "@main/utils/baseProvider";
import { IpcContext, IpcHandle, IpcOn } from "@main/utils/onIpcEvent";
import { discordEmbedFromTrack, TrackData } from "@main/utils/trackData";
import translations from "@translations/index";
import { DiscordActivity, DiscordActivityStatusDisplayType, DiscordActivityType } from "discord-rpc";
import { type App } from "electron";

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
export default class DiscordProvider extends BaseProvider implements AfterInit {
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
	private updateActivity(activity: DiscordActivity, options?: Partial<{ showButtons?: boolean; showThumbnails?: boolean }>) {
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
				activity.assets = {
					large_image: "logo",
					large_text: translations.appName,
				};
			else activity.assets.large_image = "logo";
		}
		this.rpcManager.setActivity(activity);
	}
	get settingsEnabled() {
		return !!this.settingsInstance.get("discord.enabled", false);
	}

	async disable() {
		this.rpcManager.destroy();
	}

	async enable() {
		await this.rpcManager.connect();
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

	async updateTrackProgress(isPlaying: boolean, mediaProgress: number = 0) {
		if (this.trackService.trackData && this.isConnected) {
			this.updateActivity(discordEmbedFromTrack(this.trackService.trackData, isPlaying, mediaProgress));
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
		debounce: 100,
	})
	private async __onTrackInfo(track: TrackData) {
		if (!track?.video) return;
		this.updateActivity(discordEmbedFromTrack(track));
	}
}
