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
    if (this.client) {
      if (!this.client.isConnected) await this.disable();
      else return;
    }
    clearTimeout(this._updateHandle);
    await this.createClient();
  }

  async disable() {
    if (!this.client) return;
    clearTimeout(this._updateHandle);
    this._isConnected = false;
    await this.client.user.clearActivity().catch(() => {});
    await this.client
      .destroy()
      .finally(() => {
        this.onDisconnected();
      })
      .catch((err) => {
        this.logger.error(err);
      });
    this.client = null;
    this._presence = null;
  }

  private async createClient(
    presence: Presence = DEFAULT_PRESENCE,
  ): Promise<[DiscordClient, Presence] | null> {
    if (!this._enabled || this.isConnected) return null;
    this._enabled = true;
    const client = new DiscordClient({
      clientId: this.clientId,
    });

    try {
      await client.login();
      this.logger.debug("connected");
      this._isConnected = true;
      this.presence = presence;
      this.client = client;
      this.onConnected();
      this._refreshActivity(true);
      return [client, presence];
    } catch (err) {
      this._isConnected = false;
      this.onDisconnected();
      this.logger.debug(err);
      return new Promise((resolve, reject) =>
        setTimeout(() => {
          this.createClient().then(resolve).catch(reject);
        }, 2500),
      );
    }
  }

  private _refreshActivity(initial?: boolean) {
    if (this._updateHandle) clearTimeout(this._updateHandle);
    if (this.client && this._isConnected)
      (initial ? Promise.resolve() : this.setActivity(this.presence)).then(
        () =>
          (this._updateHandle = setTimeout(() => this._refreshActivity(), DISCORD_UPDATE_INTERVAL)),
      );
  }

  async setActivity(presence: Partial<Presence>) {
    if (!this.client || !this.isConnected) return;
    this.presence = { ...presence, ...DEFAULT_PRESENCE };
    this.logger.debug("setActivity", this.presence);
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
        await this.rpcManager.setActivity(
          discordEmbedFromTrack(track, playing, trackState.progress),
        );
      }
    }
  }

  async AfterInit() {
    const settings = this.settingsInstance.instance;
    if (!settings.discord.enabled || !this._enabled) return;
    if (this.trackService.trackData) await this.enable();
  }

  async updateTrackProgress(isPlaying: boolean, mediaProgress: number = 0) {
    if (this.trackService.trackData && this.isConnected)
      await this.rpcManager.setActivity(
        discordEmbedFromTrack(this.trackService.trackData, isPlaying, mediaProgress),
      );
  }

  @IpcOn("settingsProvider.change", {
    filter: (key: string) => key === "discord.enabled",
    debounce: 1000,
  })
  private async __onToggleEnabled(key: string, enabled: boolean) {
    if (enabled) {
      await this.enable();
    } else {
      await this.rpcManager.disable();
    }
  }

  @IpcOn("settingsProvider.change", {
    filter: (key: string) => key === "discord.buttons",
    debounce: 1000,
  })
  private async __onToggleButtons() {
    if (this.isConnected) {
      const track = this.trackService.trackData;
      if (track) {
        await this.rpcManager.setActivity(discordEmbedFromTrack(track));
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
