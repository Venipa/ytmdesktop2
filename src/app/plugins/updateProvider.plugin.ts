import { App, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import { isDevelopment } from "../utils/devUtils";
import SettingsProvider from "./settingsProvider.plugin";
import { AfterInit, BaseProvider, BeforeStart } from "./_baseProvider";
import { IpcContext, IpcOn } from "../utils/onIpcEvent";
const [GITHUB_AUTHOR, GITHUB_REPOSITORY] = isDevelopment
  ? [null, null]
  : process.env.VUE_APP_GITHUB_REPOSITORY.split("/", 2);
@IpcContext
export default class EventProvider extends BaseProvider
  implements BeforeStart, AfterInit {
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
  BeforeStart() {
    if (!isDevelopment) {
      const settings = this.settingsInstance.instance;
      const app = settings.app;

      autoUpdater.logger = this.logger;
      autoUpdater.setFeedURL({
        provider: "github",
        owner: GITHUB_AUTHOR,
        repo: GITHUB_REPOSITORY,
      });
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.on("update-available", () => {
        this._updateAvailable = true;
      });
      autoUpdater.signals.updateDownloaded(() => {
        (this._updateAvailable = true), (this._updateDownloaded = true);

        if (app.autoupdate) autoUpdater.quitAndInstall(true);
      });
      if (app.autoupdate) autoUpdater.checkForUpdatesAndNotify();
    }
  }
  AfterInit() {
    autoUpdater.on("update-available", () => {
      if (this.views.settingsWindow)
        this.views.settingsWindow.webContents.send("app.updateAvailable");
    });
    autoUpdater.signals.updateDownloaded(() => {
      if (this.views.settingsWindow)
        this.views.settingsWindow.webContents.send("app.updateDownloaded");
    });
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
  @IpcOn("settingsProvider.change", {
    debounce: 1000,
    filter: (key: string) => key === "app.autoupdate",
  })
  onAutoUpdateToggled() {
    const autoUpdateEnabled = this.settingsInstance.instance.app.autoupdate;
    if (!isDevelopment) {
      if (autoUpdateEnabled) {
        if (!this._autoUpdateCheckHandle)
          this._autoUpdateCheckHandle = setInterval(() => {
            autoUpdater.checkForUpdates().then((x) => {
              if (x && x.updateInfo && this.views.settingsWindow)
                this.views.settingsWindow.webContents.send(
                  "app.updateAvailable"
                );
            });
          }, 1000 * 60 * 5);
      } else if (this._autoUpdateCheckHandle) {
        clearInterval(this._autoUpdateCheckHandle);
      }
    }
  }
}
