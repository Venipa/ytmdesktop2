import {
  App,
  BrowserWindow,
  Tray,
} from "electron";
import SettingsProvider from "./settingsProvider.plugin";
import {
  BaseProvider,
  AfterInit,
  BeforeStart,
} from "../utils/baseProvider";
import { basename, resolve } from "path";
import { IpcContext, IpcOn } from "../utils/onIpcEvent";
import { createTrayMenu } from "../utils/trayMenu";
@IpcContext
export default class EventProvider extends BaseProvider
  implements AfterInit, BeforeStart {
  get settingsInstance(): SettingsProvider {
    return this.getProvider("settings");
  }
  private _tray: Tray;
  get Tray() {
    return this._tray;
  }
  constructor(private app: App) {
    super("startup");
  }
  async BeforeStart() {}
  private async initializeTray() {
    this._tray = new Tray(resolve(__static, "favicon.ico"));
    this._tray.setToolTip(`Youtube Music for Desktop`);
    this._tray.addListener('click', () => BrowserWindow.fromBrowserView(this.views.youtubeView)?.show());
    this._tray.setContextMenu(this.buildMenu());
  }
  private buildMenu() {
    return createTrayMenu(this);
  }
  private get startArgs() {
    return ["--processStart", `"${basename(process.execPath)}"`];
  }
  async AfterInit() {
    const app = this.settingsInstance.instance.app;
    if (app.autostart) {
      this.app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath,
        args: this.startArgs,
      });
    } else {
      this.app.setLoginItemSettings({
        openAtLogin: false,
        args: this.startArgs,
      });
    }
    this.initializeTray();
  }
  @IpcOn("settingsProvider.change", {
    debounce: 50,
  })
  private onSettingsChange() {
    if (this._tray) this._tray.setContextMenu(this.buildMenu());
  }
  @IpcOn("settingsProvider.change", {
    debounce: 1000,
    filter: (key: string, enabled: boolean) => key === "app.autostart",
  })
  private async onAutoStartToggle(key: string, enabled: boolean) {
    if (enabled) {
      this.app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath,
        args: this.startArgs,
      });
    } else {
      this.app.setLoginItemSettings({
        openAtLogin: false,
        args: this.startArgs,
      });
    }
  }
}
