import translations from "@/translations";
import { Client as DiscordClient, Presence } from "discord-rpc";
import { App } from "electron";

import { AfterInit, BaseProvider } from "@/app/utils/baseProvider";
import { IpcContext, IpcHandle, IpcOn } from "@/app/utils/onIpcEvent";
import { discordEmbedFromTrack, TrackData } from "@/app/utils/trackData";
import { YoutubeMatcher } from "@/app/utils/youtubeMatcher";
import SettingsProvider from "./settingsProvider.plugin";
import TrackProvider from "./trackProvider.plugin";

const DISCORD_UPDATE_INTERVAL = 1000 * 15;
const DEFAULT_PRESENCE: Presence = {
  largeImageKey: "logo",
  largeImageText: translations.appName,
};
const CLIENT_ID = process.env.VUE_APP_DISCORD_CLIENT_ID;
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
  get settingsInstance(): SettingsProvider {
    return this.getProvider("settings");
  }
  get trackService(): TrackProvider {
    return this.getProvider("track");
  }
  constructor(private app: App) {
    super("discord");
  }
  async disable() {
    if (!this.client) return;
    this._isConnected = false;
    await this.client.destroy();
    clearTimeout(this._updateHandle);
    this.client = null;
    this.windowContext.sendToAllViews("discord.disconnected");
  }
  async enable() {
    if (this.client) return;
    this._isConnected = false;
    clearTimeout(this._updateHandle);
    await this.createClient();
    this._isConnected = true;
    this.windowContext.sendToAllViews("discord.connected");
  }
  private async createClient(): Promise<[DiscordClient, Presence]> {
    if (!this._enabled || this.isConnected) return null;
    this._enabled = true;
    const client = new DiscordClient({
      transport: "ipc",
    });
    const presence: Presence = {
      largeImageKey: "logo",
      largeImageText: translations.appName,
    };
    client.on("ready", () => this.logger.debug("ready"));
    client.on(
      "connected",
      () => (this.logger.debug("connected"), (this._isConnected = true))
    );
    client.on("ready", () => this.onClientReady());
    this.presence = presence;
    this.client = client;
    await client
      .login({
        clientId: CLIENT_ID,
      })
      .catch((err) => {
        this.logger.debug(err);
        return new Promise((resolve, reject) =>
          setTimeout(() => {
            this.createClient().then(resolve).catch(reject);
          }, 5000)
        );
      });
    return [client, presence];
  }
  private _refreshActivity() {
    if (this._updateHandle) clearTimeout(this._updateHandle);
    if (this.client && this._isConnected)
      this.setActivity(this.presence).then(
        () =>
          (this._updateHandle = setTimeout(
            () => this._refreshActivity(),
            DISCORD_UPDATE_INTERVAL
          ))
      );
    else if (this.settingsInstance.get("discord.enabled") && this._enabled) {
      this.createClient();
    }
  }
  async AfterInit() {
    const settings = this.settingsInstance.instance;
    if (!settings.discord.enabled || !this._enabled) return;
    await this.createClient();
  }
  async updatePlayState(val: boolean, progress: number = 0) {
    if (this.trackService.trackData)
      await this.setActivity(
        discordEmbedFromTrack(this.trackService.trackData, val, progress)
      );
  }
  async setActivity(presence: Partial<Presence>) {
    if (!this.presence) return;
    this.presence = { ...presence, ...DEFAULT_PRESENCE };
    if (this.presence.buttons) {
      if (
        this.presence.buttons.findIndex((x) => !x.url.match(/^http/)) !== -1
      ) {
        this.presence.buttons = this.presence.buttons.filter(
          (x) => !x.url.match(/^http/)
        );
      }
      if (this.presence.buttons.length > 2) {
        this.presence.buttons = this.presence.buttons.slice(0, 2);
      }
      if (
        this.presence.buttons.length === 0 ||
        !this.settingsInstance.instance.discord.buttons
      )
        delete this.presence.buttons;
    }
    if (YoutubeMatcher.Thumbnail.test(presence.largeImageKey)) {
      this.presence.largeImageKey = presence.largeImageKey;
    }
    if (this.presence.startTimestamp === null)
      delete this.presence.startTimestamp;
    if (this.presence.endTimestamp === null) delete this.presence.endTimestamp;
    if (this.client)
      return await this.client
        .setActivity(this.presence || DEFAULT_PRESENCE, process.pid)
        .catch(() => null);
  }
  @IpcOn("settingsProvider.change", {
    filter: (key: string) => key === "discord.enabled",
    debounce: 1000,
  })
  private async __onToggleEnabled(key: string, enabled: boolean) {
    if (enabled && (!this.client || !this._isConnected)) {
      this.createClient();
    } else if (this.client) {
      this.client.destroy();
      this.client = null;
      this._isConnected = false;
      this.windowContext.sendToAllViews("discord.disconnected");
    }
  }
  @IpcOn("settingsProvider.change", {
    filter: (key: string) => key === "discord.buttons",
    debounce: 1000,
  })
  private async __onToggleButtons() {
    if (this.client) this.onClientReady();
  }
  async onClientReady() {
    const track = this.trackService.trackData;
    if (track) this.setActivity(discordEmbedFromTrack(track));
    else
      this.setActivity({
        ...DEFAULT_PRESENCE,
        state: "Browsing...",
        buttons: [],
      });
    if (this._updateHandle) clearTimeout(this._updateHandle);
    this._updateHandle = setTimeout(
      () => this._refreshActivity(),
      DISCORD_UPDATE_INTERVAL
    );

    this.windowContext.sendToAllViews("discord.connected");
  }
  @IpcHandle("req:discord.connected")
  private async __onDiscordStatus() {
    return (
      DISCORD_SERVICE_ENABLED &&
      this.client &&
      this.enabled &&
      this._isConnected
    );
  }
  @IpcOn("track:change", {
    debounce: 100,
  })
  private async __onTrackInfo(track: TrackData) {
    if (!this.client || !track?.video) return;
    this.setActivity(discordEmbedFromTrack(track));
  }
}
