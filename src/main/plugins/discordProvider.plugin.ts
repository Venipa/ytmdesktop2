import translations from "@translations/index";
import { Client as DiscordClient, SetActivity as Presence } from "@xhayper/discord-rpc";
import { App } from "electron";

import { AfterInit, BaseProvider } from "@main/utils/baseProvider";
import { IpcContext, IpcHandle, IpcOn } from "@main/utils/onIpcEvent";
import { TrackData, discordEmbedFromTrack } from "@main/utils/trackData";
import { YoutubeMatcher } from "@main/utils/youtubeMatcher";

const DISCORD_UPDATE_INTERVAL = 1000 * 15;
const DEFAULT_PRESENCE: Presence = {
  largeImageKey: "logo",
  largeImageText: translations.appName,
};
const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
const DISCORD_SERVICE_ENABLED = !!CLIENT_ID;

@IpcContext
export default class DiscordProvider extends BaseProvider implements AfterInit {
  private _updateHandle: any;
  private _isConnected: boolean = false;
  get isConnected() {
    return this._isConnected;
  }
  private _enabled = !!DISCORD_SERVICE_ENABLED;
  get enabled() {
    return this._enabled;
  }
  private client: DiscordClient;
  private _presence: Presence;
  get presence() {
    return this._presence;
  }
  set presence(val: Presence) {
    this._presence = val;
  }
  get settingsInstance() {
    return this.getProvider("settings");
  }
  get trackService() {
    return this.getProvider("track");
  }
  constructor(private app: App) {
    super("discord");
  }
  get settingsEnabled() {
    return !!this.settingsInstance.get("discord.enabled", false);
  }
  async disable() {
    if (!this.client) return;
    clearTimeout(this._updateHandle);
    this._isConnected = false;
    await this.client.user?.clearActivity();
    await this.client
      .destroy()
      .finally(() => {
        this.windowContext.sendToAllViews("discord.disconnected");
      })
      .catch((err) => {
        this.logger.error(err);
      });
    this.client = null;
    this.presence = null;
  }
  async enable() {
    if (this.client) return;
    clearTimeout(this._updateHandle);
    await this.createClient();
    this._isConnected = true;
    this.windowContext.sendToAllViews("discord.connected");
  }
  private async createClient(): Promise<[DiscordClient, Presence]> {
    if (!this._enabled || this.isConnected) return null;
    this._enabled = true;
    const client = new DiscordClient({
      clientId: CLIENT_ID,
    });
    const presence: Presence = {
      largeImageKey: "logo",
      largeImageText: translations.appName,
    };
    client.on("connected", () => (this.logger.debug("connected"), (this._isConnected = true)));
    client.on("ready", () => this.onClientReady());
    this.presence = presence;
    this.client = client;
    await client.login().catch((err) => {
      this.logger.debug(err);
      return new Promise((resolve, reject) =>
        setTimeout(() => {
          this.createClient().then(resolve).catch(reject);
        }, 5000),
      );
    });
    return [client, presence];
  }
  private _refreshActivity(initial?: boolean) {
    if (this._updateHandle) clearTimeout(this._updateHandle);
    if (this.client && this._isConnected)
      (initial ? Promise.resolve() : this.setActivity(this.presence)).then(
        () =>
          (this._updateHandle = setTimeout(() => this._refreshActivity(), DISCORD_UPDATE_INTERVAL)),
      );
    else if (this.settingsEnabled && this._enabled) {
      this.createClient();
    }
  }
  async AfterInit() {
    const settings = this.settingsInstance.instance;
    if (!settings.discord.enabled || !this._enabled) return;
    await this.createClient();
  }
  async updatePlayState(val: boolean, progress: number = 0) {
    if (this.trackService.trackData && this.isConnected)
      await this.setActivity(discordEmbedFromTrack(this.trackService.trackData, val, progress));
  }
  async setActivity(presence: Partial<Presence>) {
    this.presence = { ...presence, ...DEFAULT_PRESENCE };
    if (this.presence.buttons) {
      if (this.presence.buttons.findIndex((x) => !x.url.match(/^http/)) !== -1) {
        this.presence.buttons = this.presence.buttons.filter((x) => !x.url.match(/^http/));
      }
      if (this.presence.buttons.length > 2) {
        this.presence.buttons = this.presence.buttons.slice(0, 2);
      }
      if (this.presence.buttons.length === 0 || !this.settingsInstance.instance.discord.buttons)
        delete this.presence.buttons;
    }
    if (YoutubeMatcher.Thumbnail.test(presence.largeImageKey)) {
      this.presence.largeImageKey = presence.largeImageKey;
    }
    if (this.presence.startTimestamp === null) delete this.presence.startTimestamp;
    if (this.presence.endTimestamp === null) delete this.presence.endTimestamp;
    if (!this.client || !this.isConnected) return;
    return await this.client.user?.setActivity(this.presence || DEFAULT_PRESENCE).catch(() => null);
  }
  @IpcOn("settingsProvider.change", {
    filter: (key: string) => key === "discord.enabled",
    debounce: 1000,
  })
  private async __onToggleEnabled(key: string, enabled: boolean) {
    await this[!enabled ? "disable" : "enable"]
      .bind(this)()
      .catch((err: any) => {
        this.logger.error(err);
      });
  }
  @IpcOn("settingsProvider.change", {
    filter: (key: string) => key === "discord.buttons",
    debounce: 1000,
  })
  private async __onToggleButtons() {
    if (this.client) this.onClientReady();
  }
  async onClientReady() {
    this.logger.debug("ready");
    const track = this.trackService.trackData;
    if (track) this.setActivity(discordEmbedFromTrack(track));
    this._refreshActivity(true);
    this.windowContext.sendToAllViews("discord.connected");
  }
  @IpcHandle("req:discord.connected")
  private async __onDiscordStatus() {
    return DISCORD_SERVICE_ENABLED && this.client && this.enabled && this._isConnected;
  }
  @IpcOn("track:change", {
    debounce: 100,
  })
  private async __onTrackInfo(track: TrackData) {
    if (!this.client || !track?.video || !this.isConnected) return;
    this.setActivity(discordEmbedFromTrack(track));
  }
}
