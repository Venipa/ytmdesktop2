import { App, BrowserWindow, ipcMain, Menu, Tray } from "electron";
import { debounce } from "lodash-es";
import { isDevelopment } from "../utils/devUtils";
import SettingsProvider from "./settingsProvider.plugin";
import { BaseProvider, AfterInit, OnInit, BeforeStart } from "./_baseProvider";
import { basename, resolve } from "path";
import { IpcOn } from "../utils/onIpcEvent";
import AutoLaunch from "auto-launch";

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
  async BeforeStart() {
    this.app.whenReady().then(() => {});
  }
  private async initializeTray() {
    this._tray = new Tray(resolve(__dirname), "assets/logo.ico");
    this._tray.setToolTip(`Youtube Music Desktop v2`);
    this._tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Show Window",
          click: () => {
            const wnd = BrowserWindow.fromBrowserView(this.views.youtubeView);
            if (wnd) wnd.show();
          },
        },
        {
          type: "separator",
        },
        {
          label: "Quit",
          click: () => this.app.quit(),
        },
      ])
    );
  }
  private autoLaunch: AutoLaunch;
  async AfterInit() {
    const settings = this.settingsInstance.instance().app;
    this.autoLaunch = new AutoLaunch({
      name: "Youtube Music for Desktop",
      path: this.app.getPath("exe"),
    });
    if (this.autoLaunch.isEnabled() && !settings.autostart)
      await this.autoLaunch.disable();
    else if (!this.autoLaunch.isEnabled() && settings.autostart)
      await this.autoLaunch.enable();
    this.initializeTray();
  }
  @IpcOn("settingsProvider.update", {
    debounce: 1000,
    filter: (key: string, enabled: boolean) => key === "app.autostart",
  })
  async onAutoStartToggle(key: string, enabled: boolean) {
    if (await this.autoLaunch.isEnabled() !== enabled) {
      await this.autoLaunch[enabled ? "enable" : "disable"]();
    }
  }
}
