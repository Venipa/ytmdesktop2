import { App } from "electron";
import { IpcContext, IpcOn } from "../utils/onIpcEvent";
import { Client as DiscordClient, Presence } from "discord-rpc";
import SettingsProvider from "./settingsProvider.plugin";
import { BaseProvider, AfterInit } from "./_baseProvider";
import { TrackInfoEvent } from "../interfaces/trackEvent";
import TrackProvider from "./trackProvider.plugin";
import { debounce } from "lodash-es";
const DISCORD_UPDATE_INTERVAL = 1000 * 15;
const DEFAULT_PRESENCE: Presence = {
  largeImageKey: "logo",
  largeImageText: "Youtube Music for Desktop",
};
@IpcContext
export default class EventProvider extends BaseProvider implements AfterInit {
  private _updateHandle: any;
  private clientId: string;
  private client: DiscordClient;
  private presence: Presence;
  private lastTrack: TrackInfoEvent;
  get settingsInstance(): SettingsProvider {
    return this.getProvider("settings");
  }
  get trackService(): TrackProvider {
    return this.getProvider("track");
  }
  constructor(private app: App) {
    super("discordRPC");
    this.clientId = process.env.VUE_DISCORD_CLIENT_ID;
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
    client.login({
      clientId: this.clientId,
    });
    return [client, presence];
  }
  private _refreshActivity() {
    if (this.client)
      this.setActivity(this.presence).then(
        () =>
          (this._updateHandle = setTimeout(
            this._refreshActivity,
            DISCORD_UPDATE_INTERVAL
          ))
      );
  }
  async AfterInit() {
    const settings = this.settingsInstance.instance();
    if (!settings.discord.enabled) return;
    const [client, presence] = await this.createClient();
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
      if (this.presence.buttons.length === 0) delete this.presence.buttons;
    }
    this.logger.debug({...this.presence});
    if (this.client)
      return await this.client.setActivity(
        this.presence || DEFAULT_PRESENCE,
        process.pid
      );
  }
  @IpcOn("settingsProvider.change", {
    filter: (key: string) => key === "discord.enabled",
    debounce: 1000,
  })
  private async __onToggleEnabled(key: string, enabled: boolean) {
    this.logger.debug(key, enabled);
    if (this._updateHandle) clearTimeout(this._updateHandle);
    if (!this.client && enabled) {
      const [client, presence] = await this.createClient();
    } else if (!enabled && this.client) {
      await this.client.destroy();
      this.client = null;
      this.presence = null;
    }
  }
  async onClientReady() {
    const track = await this.trackService.getCurrentTrack();
    if (track)
      this.setActivity({
        details: track.title,
        state: "Playing",
        buttons: [
          {
            label: "Listen to Audio",
            url: track.url,
          },
        ],
      });
    else
      this.setActivity({
        state: "Browsing...",
      });

    this._updateHandle = setTimeout(
      this._refreshActivity,
      DISCORD_UPDATE_INTERVAL
    );
  }
  @IpcOn("track:info", {
    debounce: 1000,
  })
  private async __onTrackInfo(ev, ...[track]: [TrackInfoEvent]) {
    this.logger.debug(track);
    if (!this.client || !track.title) return;
    this.lastTrack = track;
    this.setActivity({
      details: track.title,
      state: "Playing",
      buttons: [
        {
          label: "Listen to Audio",
          url: track.url,
        },
      ],
    });
  }
}
