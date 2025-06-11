import translations from "@translations/index";
import { Client as DiscordClient, SetActivity as Presence } from "@xhayper/discord-rpc";
import { App } from "electron";

import { AfterInit, BaseProvider } from "@main/utils/baseProvider";
import { IpcContext, IpcHandle, IpcOn } from "@main/utils/onIpcEvent";
import { TrackData, discordEmbedFromTrack } from "@main/utils/trackData";
import { YoutubeMatcher } from "@main/utils/youtubeMatcher";
import { Logger } from "@shared/utils/console";

const DISCORD_UPDATE_INTERVAL = 1000 * 15;
const DEFAULT_PRESENCE: Presence = {
	largeImageKey: "logo",
	largeImageText: translations.appName,
};
const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
const DISCORD_SERVICE_ENABLED = !!CLIENT_ID;

class DiscordRPCManager {
	private client: DiscordClient | null = null;
	private _isConnected: boolean = false;
	private _updateHandle: any;
	private _presence: Presence | null = null;
	private _enabled: boolean = false;

	constructor(
		private clientId: string,
		private onConnected: () => void,
		private onDisconnected: () => void,
		private onError: (err: Error | unknown) => void,
		private logger: Logger = new Logger("DiscordRPCManager"),
	) {}

	get isConnected() {
		return this._isConnected;
	}

	get enabled() {
		return this._enabled;
	}

	get presence() {
		return this._presence!;
	}

	get rpcClient() {
		return this.client;
	}

	private set presence(val: Presence) {
		this._presence = val;
	}

	async enable() {
		if (this.client?.isConnected) return;

		if (!this.enabled) {
			if (this.isConnected) await this.disable();
		}
		clearTimeout(this._updateHandle);
		const [client, presence] = await this.createClient()
			.then((instance) => {
				this.logger.debug("connected to discord");
				return instance || [null, null];
			})
			.catch((err) => {
				this.logger.error("error while connecting to discord", err);
				return [null, null] as [DiscordClient, Presence];
			});
		this.client = client;
		this.presence = presence;
		this._enabled = !!client?.isConnected;
	}

	async disable() {
		if (this._createClientAbortController) {
			this._createClientAbortController.abort("discord has been disabled by user");
			this.logger.debug("aborting client creation", this._createClientAbortController.signal.aborted);
		}
		if (!this.client) return;
		clearTimeout(this._updateHandle);
		this._isConnected = false;
		await this.client.user.clearActivity().catch(() => {});
		await this.client
			.destroy()
			.then(() => {
				this.onDisconnected();
				this.logger.debug("disconnected from discord");
			})
			.catch((err) => {
				this.logger.error("error while disconnecting from discord", err);
			});
		this.client = null;
		this._presence = null;
		this._enabled = false;
	}

	private _createClientAbortController: AbortController | null = null;
	private async createClient(presence: Presence = DEFAULT_PRESENCE, isAborted: boolean = false): Promise<[DiscordClient, Presence] | null> {
		if (isAborted) {
			this.logger.debug("creating client aborted", isAborted);
			this.onError(null);
			this._createClientAbortController = null;
			throw new Error("Creating client aborted");
		}
		const { signal } = this._createClientAbortController || (this._createClientAbortController = new AbortController());

		this.logger.debug("creating client", this.clientId, { signal: signal.aborted });
		const client = new DiscordClient({
			clientId: this.clientId,
			transport: {
				type: "ipc",
			},
		});
		signal.addEventListener("abort", () => {
			isAborted = true;
		});

		try {
			await client.login().catch((err) => {
				this.logger.error("error while connecting to discord", err);
				throw err;
			});
			this.logger.debug("connected");
			this._isConnected = true;
			this.presence = presence;
			this.client = client;
			this.onConnected();
			await this._refreshActivity(true);
			client
				.once("error", (err) => {
					this.logger.error("discord error", err);
					this.onDisconnected();
					this.enable();
				})
				.once("disconnect", () => {
					this.logger.error("discord disconnected, trying to reconnect");
					this.onDisconnected();
					this.enable();
				});
			return [client, presence];
		} catch (err) {
			this._isConnected = false;
			this.onDisconnected();
			this.logger.error("error while connecting to discord", err);
			if (isAborted) {
				this._createClientAbortController = null;
				this.onError(null);
				throw err;
			}
			this.onError(err as Error);
			return await new Promise((resolve, reject) => {
				setTimeout(() => {
					if (signal.aborted) {
						this._createClientAbortController = null;
						this.onError(null);
						reject(err);
					}
					this.createClient(undefined, isAborted).then(resolve).catch(reject);
				}, 2500);
			});
		}
	}

	private _refreshActivity(initial: boolean = false) {
		if (this._updateHandle) clearTimeout(this._updateHandle);
		return new Promise<void>((resolve, reject) => {
			if (this.client && this._isConnected)
				(initial ? Promise.resolve() : this.setActivity(this.presence, false)).then(() => {
					resolve();
					return (this._updateHandle = setTimeout(() => this._refreshActivity(), DISCORD_UPDATE_INTERVAL));
				});
			else reject(new Error("Discord client not connected"));
		});
	}

	async setActivity(presence: Partial<Presence>, resetUpdateHandle = true) {
		if (!this.client || !this.isConnected) return;
		this.presence = { ...presence, ...DEFAULT_PRESENCE };
		if (this.presence.buttons) {
			if (this.presence.buttons.findIndex((x) => !x.url.match(/^http/)) !== -1) {
				this.presence.buttons = this.presence.buttons.filter((x) => !x.url.match(/^http/));
			}
			if (this.presence.buttons.length > 2) {
				this.presence.buttons = this.presence.buttons.slice(0, 2);
			}
			if (this.presence.buttons.length === 0) delete this.presence.buttons;
		}

		if (presence.largeImageKey && YoutubeMatcher.Thumbnail.test(presence.largeImageKey)) {
			this.presence.largeImageKey = presence.largeImageKey;
		} else this.presence.largeImageKey = DEFAULT_PRESENCE.largeImageKey!;

		if (this.presence.startTimestamp === null) delete this.presence.startTimestamp;
		if (this.presence.endTimestamp === null) delete this.presence.endTimestamp;
		if (resetUpdateHandle) await this._refreshActivity(false);
		return await this.client.user?.setActivity(this.presence).catch((err) => {
			this.logger.error(err);
		});
	}
}

@IpcContext
export default class DiscordProvider extends BaseProvider implements AfterInit {
	private rpcManager: DiscordRPCManager;
	private _enabled = !!DISCORD_SERVICE_ENABLED;

	constructor(private app: App) {
		super("discord");
		this.rpcManager = new DiscordRPCManager(
			CLIENT_ID,
			() => this.windowContext.sendToAllViews("discord.connected"),
			() => this.windowContext.sendToAllViews("discord.disconnected"),
			(err) => this.windowContext.sendToAllViews("discord.error", err),
			this.logger,
		);
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

	get rpcClient() {
		return this.rpcManager.rpcClient;
	}

	private get settingsInstance() {
		return this.getProvider("settings");
	}

	private get trackService() {
		return this.getProvider("track");
	}

	get settingsEnabled() {
		return !!this.settingsInstance.get("discord.enabled", false);
	}

	async disable() {
		await this.rpcManager.disable();
	}

	async enable() {
		await this.rpcManager.enable();
		if (this.trackService.trackData) {
			const { trackData: track, playing, trackState } = this.trackService;
			if (track) {
				await this.rpcManager.setActivity(discordEmbedFromTrack(track, playing, trackState?.progress ?? 0));
			}
		}
	}

	async AfterInit() {
		const settings = this.settingsInstance.instance;
		if (!settings.discord.enabled || this._enabled) return;
		await this.enable();
	}

	async updateTrackProgress(isPlaying: boolean, mediaProgress: number = 0) {
		if (this.trackService.trackData && this.isConnected) {
			await this.rpcManager.setActivity(discordEmbedFromTrack(this.trackService.trackData, isPlaying, mediaProgress));
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
	private async __onToggleButtons() {
		if (this.trackService.trackData) {
			const { trackData: track, playing, trackState } = this.trackService;
			if (track) {
				await this.rpcManager.setActivity(discordEmbedFromTrack(track, playing, trackState?.progress ?? 0));
			}
		}
	}

	@IpcHandle("req:discord.connected")
	private async handleDiscordState() {
		return DISCORD_SERVICE_ENABLED && this.rpcManager.rpcClient && this.enabled && this.isConnected;
	}

	@IpcOn("track:change", {
		debounce: 100,
	})
	private async __onTrackInfo(track: TrackData) {
		if (!track?.video) return;
		await this.rpcManager.setActivity(discordEmbedFromTrack(track));
	}
}
