import { App, ipcMain } from "electron";
import { debounce } from "lodash-es";
import { isDevelopment } from "../utils/devUtils";
import SettingsProvider from "./settingsProvider.plugin";
import { BaseProvider, AfterInit, OnInit } from "./_baseProvider";
import { basename } from "path";

export default class EventProvider extends BaseProvider implements AfterInit, OnInit {
  get settingsInstance(): SettingsProvider {
    return this.getProvider("settings");
  }
  constructor(private app: App) {
    super("startup");
  }
  async OnInit() {
    const settings = this.settingsInstance;
    const app = settings.get("app");
    if (!isDevelopment && app.autoupdate) {
    }
  }
  async AfterInit() {
    const settings = this.settingsInstance;
    const app = settings.get("app");
    if (!isDevelopment) {
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
  }
}
