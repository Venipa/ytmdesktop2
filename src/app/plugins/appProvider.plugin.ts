import { App } from "electron";
import { BaseProvider, AfterInit } from "@/app/utils/baseProvider";
import { IpcContext, IpcOn } from "@/app/utils/onIpcEvent";
import { setSentryEnabled } from "@/app/utils/sentry";
import TrackProvider from "./trackProvider.plugin";
import DiscordProvider from "./discordProvider.plugin";
const STATE_PAUSE_TIME = 30e4;
@IpcContext
export default class AppProvider extends BaseProvider implements AfterInit {
  constructor(private _app: App) {
    super("app");
  }
  get app() {
    return this._app;
  }
  async AfterInit() {
    this._app.on("browser-window-focus", this.windowFocus.bind(this));
    this._app.on("browser-window-blur", this.windowBlur.bind(this));
  }
  private _blurTimestamp: Date = null;
  private _blurAfkHandle: any;
  private get isPlaying() {
    return !!this.getProvider<TrackProvider>("track")?.playing;
  }
  private get discord() {
    return this.getProvider<DiscordProvider>("discord");
  }
  private windowBlur() {
    if (this.isPlaying) return;
    if (!this._blurTimestamp) this._blurTimestamp = new Date();
    this._blurAfkHandle = setTimeout(() => {
      if (this.isPlaying) return this.windowBlur();
      const discord = this.discord;
      if (discord.enabled) discord.disable();
    }, STATE_PAUSE_TIME);
  }
  private windowFocus() {
    if (!this._blurTimestamp || this.isPlaying) return;
    const isPastDue =
      Date.now() - this._blurTimestamp.getTime() > STATE_PAUSE_TIME;
    if (!isPastDue) return;
    this._blurTimestamp = null;
    clearTimeout(this._blurAfkHandle);
    this._blurAfkHandle = null;
    const discord = this.discord;
    if (!discord.enabled) discord.enable();
  }
  @IpcOn("settingsProvider.change", {
    filter: (key: string) => key === "app.enableStatisticsAndErrorTracing",
    debounce: 10000,
  })
  private __toggleSentryLogging(_key: string, value: boolean) {
    if (value) {
      setSentryEnabled(true);
    } else {
      setSentryEnabled(false);
    }
  }
}
