import { App, BrowserWindow, dialog, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import { isDevelopment } from "../utils/devUtils";
import SettingsProvider from "./settingsProvider.plugin";
import { AfterInit, BaseProvider, BeforeStart } from "../utils/baseProvider";
import { IpcContext, IpcOn } from "../utils/onIpcEvent";
const [GITHUB_AUTHOR, GITHUB_REPOSITORY] = isDevelopment
  ? [null, null]
  : process.env.VUE_APP_GITHUB_REPOSITORY.split("/", 2);
@IpcContext
export default class UpdateProvider extends BaseProvider
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
    super("update");
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

        if (app.autoupdate) {
          autoUpdater.quitAndInstall(false);
          this.app.quit();
        }
      });
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
    if (this.settingsInstance.instance.app.autoupdate) this.onCheckUpdate();
  }
  @IpcOn("app.installUpdate", {
    debounce: 1000,
  })
  onAutoUpdateRun() {
    autoUpdater.quitAndInstall(false);
    this.app.quit();
  }
  @IpcOn("app.checkUpdate", {
    debounce: 1000,
  })
  onCheckUpdate() {
    autoUpdater.checkForUpdates().then(x => {
      if (!x?.updateInfo || x.updateInfo.version === this.app.getVersion()) throw new Error("No Update available");
      return x;
    }).then((x) => {
      return dialog
        .showMessageBox(BrowserWindow.fromBrowserView(this.views.youtubeView), {
          title: `Update available (${x.updateInfo.version})`,
          message: `Hey there, there is a new version which you can update to.\n\n${
            process.platform === "win32"
              ? x.updateInfo.releaseNotes
              : x.updateInfo.releaseName
          }`,
          type: "question",
          buttons: ["Update now", "Cancel"],
          cancelId: -1,
        })
        .then(({ response }) => {
          if (response === 0) {
            this.onAutoUpdateRun();
          }
        });
    }).catch((err: Error) => this.logger.debug(err.message));
  }
  @IpcOn("settingsProvider.change", {
    debounce: 250,
    filter: (key: string) => key === "app.beta"
  })
  onBetaToggled(key, enabled: boolean) {
    autoUpdater.allowPrerelease = enabled;
    if (!enabled) autoUpdater.allowPrerelease = false;

    this.onCheckUpdate();
  }
  private _autoUpdateCheckHandle;
  @IpcOn("settingsProvider.change", {
    debounce: 250,
    filter: (key: string) => key === "app.autoupdate",
  })
  onAutoUpdateToggled(key, autoUpdateEnabled: boolean) {
    if (!isDevelopment) {
      if (autoUpdateEnabled) {
        if (!this._autoUpdateCheckHandle)
          this._autoUpdateCheckHandle = setInterval(() => {
            this.onCheckUpdate();
          }, 1000 * 60 * 15);
      } else if (this._autoUpdateCheckHandle) {
        clearInterval(this._autoUpdateCheckHandle);
      }
    }
  }
}
