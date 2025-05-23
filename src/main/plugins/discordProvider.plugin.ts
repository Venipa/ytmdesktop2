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
  private client: DiscordClient | null = null;
  private _presence: Presence | null = null;
  get presence() {
    return this._presence!;
  }
  private set presence(val: Presence) {
    this._presence = val;
  }
  private get settingsInstance() {
    return this.getProvider("settings");
  }
  private get trackService() {
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
    await this.client.user.clearActivity().catch(() => {}); // todo: clear throws error if pipe is not writable
    await this.client
      .destroy()
      .finally(() => {
        this.windowContext.sendToAllViews("discord.disconnected");
      })
      .catch((err) => {
        this.logger.error(err);
      });
    this.client = null;
    this._presence = null;
  }
  async enable() {
    if (this.client) {
      if (!this.client.isConnected) await this.disable();
      else return;
    }
    clearTimeout(this._updateHandle);
    const {trackData: track, playing, trackState} = this.trackService
    await this.createClient(track ? discordEmbedFromTrack(track, playing, trackState.progress) : undefined);
    this.windowContext.sendToAllViews("discord.connected");
  }
  private async createClient(presence: Presence = {
    largeImageKey: "logo",
    largeImageText: translations.appName,
  }): Promise<[DiscordClient, Presence] | null> {
    if (!this._enabled || this.isConnected) return null;
    this._enabled = true;
    const client = new DiscordClient({
      clientId: CLIENT_ID,
    });
    await client
      .login()
      .then(() => {
        this.logger.debug("connected");
        this._isConnected = true;
        this.presence = presence;
        this.client = client;
        return this.onClientReady();
      })
      .catch((err) => {
        this._isConnected = false;
        this.windowContext.sendToAllViews("discord.disconnected");
        this.logger.debug(err);
        return new Promise((resolve, reject) =>
          setTimeout(() => {
            this.createClient().then(resolve).catch(reject);
          }, 2500),
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
    if (this.trackService.trackData) await this.createClient();
  }
  async updateTrackProgress(isPlaying: boolean, mediaProgress: number = 0) {
    if (this.trackService.trackData && this.isConnected)
      await this.setActivity(
        discordEmbedFromTrack(this.trackService.trackData, isPlaying, mediaProgress),
      );
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
    if (presence.largeImageKey && YoutubeMatcher.Thumbnail.test(presence.largeImageKey)) {
      this.presence.largeImageKey = presence.largeImageKey;
    } else this.presence.largeImageKey = DEFAULT_PRESENCE.largeImageKey!;
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
  private async handleDiscordState() {
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
