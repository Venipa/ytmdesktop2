import { App, BrowserWindow } from "electron";
import { BaseProvider, AfterInit, OnDestroy } from "../utils/baseProvider";
import { ApiWorker, createApiWorker } from "@/api/createApiWorker";
import SettingsProvider from "./settingsProvider.plugin";
import { IpcContext, IpcHandle, IpcOn } from "../utils/onIpcEvent";
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
  async AfterInit() {
    if (this._thread) this._thread.destroy();
    this._thread = await createApiWorker();
    const config = this.getProvider("settings") as SettingsProvider;
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
    return Object.values(API_ROUTES).map((x) => x.replace(/^\/api\//, ""));
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
    await this.views.youtubeView.webContents.executeJavaScript(
      `(el => el && el.title !== "Play" && el.click())(document.querySelector(".ytmusic-player-bar#play-pause-button"))`
    );
  }
  @IpcHandle(API_ROUTES.TRACK_CONTROL_PAUSE)
  async pauseTrack() {
    await this.views.youtubeView.webContents.executeJavaScript(
      `(el => el && el.title === "Play" && el.click())(document.querySelector(".ytmusic-player-bar#play-pause-button"))`
    );
  }
  @IpcHandle(API_ROUTES.TRACK_CONTROL_TOGGLE_PLAY)
  async toggleTrackPlayback() {
    await this.views.youtubeView.webContents
      .executeJavaScript(
        `(el => el ? el.title === "Play" : null)(document.querySelector(".ytmusic-player-bar#play-pause-button"))`
      )
      .then((x) => {
        return typeof x === "boolean"
          ? x
            ? this.pauseTrack()
            : this.playTrack()
          : null;
      });
  }
}
