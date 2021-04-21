import { App, BrowserWindow, ipcMain, IpcMainEvent } from "electron";
import { IpcContext, IpcOn } from "../utils/onIpcEvent";
import fs from "fs";
import path from "path";
import { Client as DiscordClient, Presence } from "discord-rpc";
import SettingsProvider from "./settingsProvider.plugin";
import { BaseProvider, AfterInit } from "./_baseProvider";
import { rootWindowInjectCustomCss } from "../utils/webContentUtils";
import { TrackInfoEvent } from "../interfaces/trackEvent";
const DISCORD_UPDATE_INTERVAL = 1000 * 2;
@IpcContext
export default class EventProvider extends BaseProvider implements AfterInit {
  private _updateHandle: any;
  private client: DiscordClient;
  private presence: Presence;
  get settingsInstance(): SettingsProvider {
    return this.getProvider("settings");
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
    await new Promise((resolve, reject) => {
      client.once("ready", () => resolve(null));
    });
    return [client, presence];
  }
  private _refreshActivity() {
    if (this.client)
      this.setActivity(this.presence).then(() =>
        setTimeout(this._refreshActivity, DISCORD_UPDATE_INTERVAL)
      );
  }
  async AfterInit() {
    const settings = this.settingsInstance.instance();
    if (!settings.discord.enabled) return;
    const [client, presence] = await this.createClient();
    (this.client = client), (this.presence = presence);
  }
  async setActivity(presence: Partial<Presence>) {
    this.presence = Object.entries({ ...(this.presence || {}), ...presence })
      .filter(([, value]) => value !== undefined)
      .reduce((l, [key, value]) => ({ ...l, [key]: value }), {});
    if (this.client) await this.client.setActivity(this.presence, process.pid);
  }
  @IpcOn("settingsProvider.set", {
    filter: (ev, ...[key]: string[]) => key === "discord.enabled",
    debounce: 1000,
  })
  private async __onToggleEnabled(
    ev: IpcMainEvent,
    ...[key, enabled]: [string, boolean]
  ) {
    if (!this.client && enabled) {
      const [client, presence] = await this.createClient();
      (this.client = client), (this.presence = presence);
      this.setActivity({
        state: "Browsing...",
      });
      this.client.login({
        clientId: process.env.DISCORD_CLIENT_ID,
        scopes: ["rpc"],
      });
      if (this._updateHandle) clearTimeout(this._updateHandle);
      this._updateHandle = setTimeout(
        this._refreshActivity,
        DISCORD_UPDATE_INTERVAL
      );
    } else if (!enabled && this.client) {
      await this.client.destroy();
      this.client = null;
      this.presence = null;
      if (this._updateHandle) clearTimeout(this._updateHandle);
    }
  }
  @IpcOn("track:info", {
    debounce: DISCORD_UPDATE_INTERVAL,
  })
  private async __onTrackInfo(ev, ...[track]: [TrackInfoEvent]) {
    if (!this.client || !track.title) return;
    this.setActivity({
      details: track.title,
      state: "Playing",
    });
  }
}
