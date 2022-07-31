import { App, BrowserWindow } from "electron";
import { BaseProvider, AfterInit, OnDestroy } from "@/app/utils/baseProvider";
import { ApiWorker, createApiWorker } from "@/api/createApiWorker";
import SettingsProvider from "./settingsProvider.plugin";
import { IpcContext, IpcHandle, IpcOn } from "@/app/utils/onIpcEvent";
import TrackProvider from "./trackProvider.plugin";
const API_ROUTES = {
  TRACK_CURRENT: "api/track",
  TRACK_CONTROL_NEXT: "api/track/next",
  TRACK_CONTROL_PREV: "api/track/prev",
  TRACK_CONTROL_PLAY: "api/track/play",
  TRACK_CONTROL_PAUSE: "api/track/pause",
  TRACK_CONTROL_TOGGLE_PLAY: "api/track/toggle-play-state",
};
@IpcContext
export default class ApiProvider extends BaseProvider
  implements AfterInit, OnDestroy {
  private _thread: ApiWorker;
  private _renderer: BrowserWindow;
  constructor(private _app: App) {
    super("api");
  }
  OnDestroy() {
    this._thread?.destroy();
  }
  get app() {
    return this._app;
  }
  sendMessage(...args: any[]) {
    return this._thread?.send("socket", ...args);
  }
  private get settingsProvider() {
    return this.getProvider("settings") as SettingsProvider;
  }
  private get trackProvider() {
    return this.getProvider<TrackProvider>("track");
  }
  async AfterInit() {
    if (this._thread) this._thread.destroy();
    const config = this.settingsProvider;
    if (!config.instance?.api?.enabled) return;
    this._thread = await createApiWorker(this.windowContext.main);
    const rendererId = await this._thread.invoke<number>("initialize", {
      config: { ...config!.instance },
    });
    this._renderer = BrowserWindow.getAllWindows().find(
      (x) => x.id === rendererId
    );
  }

  @IpcOn("settingsProvider.change", {
    filter: (key: string) => key === "api.enabled",
    debounce: 1000,
  })
  private async __onApiEnabled(key: string, value: boolean) {
    if (!value) {
      this._thread.destroy();
    } else {
      await this.AfterInit();
    }
  }
  @IpcHandle("api/routes")
  private async __getRoutes() {
    return Object.values(API_ROUTES).map((x) => x.replace(/^\/?api\//, ""));
  }
  @IpcHandle(API_ROUTES.TRACK_CURRENT)
  async getTrackInformation() {
    return (this.getProvider("track") as TrackProvider)?.trackData;
  }
  @IpcHandle(API_ROUTES.TRACK_CONTROL_NEXT)
  async nextTrack() {
    await this.views.youtubeView.webContents.executeJavaScript(
      `(el => el && el.click())(document.querySelector(".ytmusic-player-bar.next-button"))`
    );
  }
  @IpcHandle(API_ROUTES.TRACK_CONTROL_PREV)
  async prevTrack() {
    await this.views.youtubeView.webContents.executeJavaScript(
      `(el => el && el.click())(document.querySelector(".ytmusic-player-bar.previous-button"))`
    );
  }
  @IpcHandle(API_ROUTES.TRACK_CONTROL_PLAY)
  async playTrack() {
    if (this.trackProvider.playState === "paused")
      await this.views.youtubeView.webContents.executeJavaScript(
        `(el => el && el.click())(document.querySelector(".ytmusic-player-bar#play-pause-button"))`
      );
  }
  @IpcHandle(API_ROUTES.TRACK_CONTROL_PAUSE)
  async pauseTrack() {
    if (this.trackProvider.playState === "playing")
      await this.views.youtubeView.webContents.executeJavaScript(
        `(el => el && el.click())(document.querySelector(".ytmusic-player-bar#play-pause-button"))`
      );
  }
  @IpcHandle(API_ROUTES.TRACK_CONTROL_TOGGLE_PLAY)
  async toggleTrackPlayback() {
    if (this.trackProvider.playState === "playing") return this.pauseTrack();
    else if (this.trackProvider.playState === "paused") return this.playTrack();
    return Promise.resolve(null);
  }
}
