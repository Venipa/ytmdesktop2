import { App, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import { isDevelopment } from "../utils/devUtils";
import SettingsProvider from "./settingsProvider.plugin";
import { AfterInit, BaseProvider, OnInit } from "./_baseProvider";
import { basename } from "path";
import { IpcOn } from "../utils/onIpcEvent";

export default class EventProvider extends BaseProvider
  implements OnInit, AfterInit {
  get settingsInstance(): SettingsProvider {
    return this.getProvider("settings");
  }

  private _updateAvailable: boolean;
  public get updateAvailable() {
    return this._updateAvailable;
  }
  private _updateDownloaded: boolean;
  public get updateDownloaded() {
    return this._updateDownloaded;
  }

  constructor(private app: App) {
    super("startup");
  }
  OnInit() {
    if (!isDevelopment) {
      const settings = this.settingsInstance;
      const app = settings.get("app");

      autoUpdater.logger = this.logger;
      autoUpdater.setFeedURL({
        provider: "github",
        owner: process.env.VUE_APP_USER,
        repo: process.env.VUE_APP_REPO,
      });
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.on("update-available", () => {
        this.logger.debug("Update Available");
        this._updateAvailable = true;
        ipcMain.emit("app.updateAvailable");
      });
      autoUpdater.on("update-downloaded", () => {
        this.logger.debug("Update Downloaded");
        (this._updateAvailable = true), (this._updateDownloaded = true);
        ipcMain.emit("app.updateDownloaded");
      });
      if (app.autoupdate) autoUpdater.checkForUpdatesAndNotify();
    }
  }
  AfterInit() {
    this.logger.debug("Initialized");
  }
  @IpcOn("app.installUpdate", {
    debounce: 1000,
  })
  onAutoUpdateRun() {
    autoUpdater.quitAndInstall();
  }
  @IpcOn("app.checkUpdate", {
    debounce: 1000,
  })
  onCheckUpdate() {
    autoUpdater.checkForUpdatesAndNotify();
  }
  private _autoUpdateCheckHandle;
  @IpcOn("settingsProvider.update", {
    debounce: 1000,
    filter: (ev, [key]: [string]) => key === "app.autoupdate",
  })
  onAutoUpdateToggled(ev, [key, value]: [string, boolean]) {
    const autoUpdateEnabled = this.settingsInstance.get(
      "app.autoupdate",
      false
    );
    if (!isDevelopment) {
      if (autoUpdateEnabled) {
        if (!this._autoUpdateCheckHandle)
          this._autoUpdateCheckHandle = setInterval(() => {
            autoUpdater.checkForUpdates().then((x) => {
              if (x && x.updateInfo) ipcMain.emit("app.updateAvailable");
            });
          }, 1000 * 60 * 5);
      } else if (this._autoUpdateCheckHandle) {
        clearInterval(this._autoUpdateCheckHandle);
      }
    }
  }
}
