import { App, BrowserWindow, ipcMain, Menu, Tray } from "electron";
import { debounce } from "lodash-es";
import { isDevelopment } from "../utils/devUtils";
import SettingsProvider from "./settingsProvider.plugin";
import { BaseProvider, AfterInit, OnInit } from "./_baseProvider";
import { basename, resolve } from "path";
import { IpcOn } from "../utils/onIpcEvent";

export default class EventProvider extends BaseProvider
  implements AfterInit, OnInit {
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
  async OnInit() {
    this.app.whenReady().then(() => {
      this._tray = new Tray(resolve(__dirname), "assets/logo.ico");
      this._tray.setContextMenu(
        Menu.buildFromTemplate([
          {
            label: "Show",
            type: "normal",
            click: () =>
              BrowserWindow.getAllWindows()
                .find((x) => x.webContents.getURL().match("music.youtube"))
                ?.show(),
          },
          {
            type: "separator",
          },
          {
            label: "Quit",
            type: "normal",
          },
        ])
      );
      this._tray.setToolTip(`Youtube Music Desktop v2`);
    });
  }
  async AfterInit() {
    const settings = this.settingsInstance;
    const app = settings.get("app");
    const exeName = basename(process.execPath);
    const startupArgs = [
      "--processStart",
      `${exeName}`,
      "--process-start-args",
      "--hidden",
    ];
    if (
      app.autostart !==
      this.app.getLoginItemSettings({
        args: startupArgs,
        path: process.execPath,
      }).openAtLogin
    ) {
      this.app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath,
        enabled: !!app.autostart,
        args: startupArgs,
      });
    }
  }
  @IpcOn("settingsProvider.update", {
    debounce: 1000,
    filter: (ev, [key]: [string]) => key === "app.autostart",
  })
  async onAutoStartToggle() {
    await this.AfterInit();
  }
}
