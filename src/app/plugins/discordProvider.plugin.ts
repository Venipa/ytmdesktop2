import { IpcContext, IpcOn } from "../utils/onIpcEvent";
import { Client as DiscordClient, Presence } from "discord-rpc";
import SettingsProvider from "./settingsProvider.plugin";
import { BaseProvider, AfterInit } from "../utils/baseProvider";
import TrackProvider from "./trackProvider.plugin";
import { debounce } from "lodash-es";
import { discordEmbedFromTrack, TrackData } from "../utils/trackData";
import { App } from "electron";
const DISCORD_UPDATE_INTERVAL = 1000 * 15;
const DEFAULT_PRESENCE: Presence = {
  largeImageKey: "logo",
  largeImageText: "Youtube Music for Desktop",
};
const CLIENT_ID = process.env.VUE_APP_DISCORD_CLIENT_ID;
@IpcContext
export default class EventProvider extends BaseProvider implements AfterInit {
  private _updateHandle: any;
  private client: DiscordClient;
  private presence: Presence;
  get settingsInstance(): SettingsProvider {
    return this.getProvider("settings");
  }
  get trackService(): TrackProvider {
    return this.getProvider("track");
  }
  constructor(private app: App) {
    super("discordRPC");
  }
  private async createClient(): Promise<[DiscordClient, Presence]> {
    const client = new DiscordClient({
      transport: "ipc",
    });
    const presence: Presence = {
      largeImageKey: "logo",
      largeImageText: "Youtube Music for Desktop",
    };
    client.on("ready", () => this.logger.debug("ready"));
    client.on("connected", () => this.logger.debug("connected"));

    client.on(
      "ready",
      debounce(() => this.onClientReady(), 1000)
    );
    this.presence = presence;
    this.client = client;
    client
      .login({
        clientId: CLIENT_ID,
      })
      .catch(
        () =>
          new Promise((resolve, reject) =>
            setTimeout(() => {
              this.createClient()
                .then(resolve)
                .catch(reject);
            }, 5000)
          )
      );
    return [client, presence];
  }
  private _refreshActivity() {
    if (this._updateHandle) clearTimeout(this._updateHandle);
    if (this.client)
      this.setActivity(this.presence).then(
        () =>
          (this._updateHandle = setTimeout(
            () => this._refreshActivity(),
            DISCORD_UPDATE_INTERVAL
          ))
      );
    else if (this.settingsInstance.get("discord.enabled")) {
      this.createClient();
    }
  }
  AfterInit() {
    const settings = this.settingsInstance.instance;
    if (!settings.discord.enabled) return;
    this.createClient();
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
    if (enabled) {
      this.createClient();
    } else if (this.client) {
      this.client.destroy();
      this.client = null;
    }
  }
  @IpcOn("settingsProvider.change", {
    filter: (key: string) => key === "discord.buttons",
    debounce: 1000,
  })
  private async __onToggleButtons(key: string, enabled: boolean) {
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
  }
  @IpcOn("track:change", {
    debounce: 100,
  })
  private async __onTrackInfo(track: TrackData) {
    if (!this.client || !track?.video) return;
    this.setActivity(discordEmbedFromTrack(track));
  }
}
