import { AfterInit, BaseProvider, BeforeStart } from '@/app/utils/baseProvider';
import { isDevelopment } from '@/app/utils/devUtils';
import { IpcContext, IpcHandle, IpcOn } from '@/app/utils/onIpcEvent';
import { App, BrowserWindow, dialog } from 'electron';
import { autoUpdater, CancellationToken, UpdateInfo } from 'electron-updater';
import semver from 'semver';

import IPC_EVENT_NAMES from '../utils/eventNames';
import SettingsProvider from './settingsProvider.plugin';

if (isDevelopment) process.env.__SKIP_BUILD == null;
const [GITHUB_AUTHOR, GITHUB_REPOSITORY] =
  process.env.VUE_APP_GITHUB_REPOSITORY.split("/", 2);
@IpcContext
export default class UpdateProvider
  extends BaseProvider
  implements BeforeStart, AfterInit
{
  get settingsInstance(): SettingsProvider {
    return this.getProvider("settings");
  }
  private _update: UpdateInfo;
  private _updateAvailable: boolean;
  private _updateQueuedForInstall: boolean = false;
  get updateQueuedForInstall() {
    return this._updateQueuedForInstall;
  }
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
    autoUpdater.logger = this.logger;
    autoUpdater.setFeedURL({
      provider: "github",
      owner: GITHUB_AUTHOR,
      repo: GITHUB_REPOSITORY,
    });
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = !isDevelopment;
    this.logger.debug(autoUpdater.updateConfigPath);
    this.logger.debug("Updater Cache: " + autoUpdater["app"].baseCachePath);
    autoUpdater.on("update-available", (ev) => {
      this._updateAvailable = ev && this.isUpdateInRange(ev.version);
      if (this.updateAvailable) this._update = ev;
      else this._update = null;
      if (this._updateAvailable)
        this.windowContext.sendToAllViews(IPC_EVENT_NAMES.APP_UPDATE, ev);

        
      this.windowContext.sendToAllViews(
        IPC_EVENT_NAMES.APP_UPDATE_CHECKING,
        false
      );
    });
    autoUpdater.on("update-not-available", () => {
      this.windowContext.sendToAllViews(
        IPC_EVENT_NAMES.APP_UPDATE_CHECKING,
        false
      );
    });
    autoUpdater.on("checking-for-update", () => {
      this.windowContext.sendToAllViews(
        IPC_EVENT_NAMES.APP_UPDATE_CHECKING,
        true
      );
    });
    autoUpdater.on("download-progress", (ev) => {
      if (this.updateDownloaded) return;
      this.windowContext.sendToAllViews(
        IPC_EVENT_NAMES.APP_UPDATE_PROGRESS,
        ev
      );
    });
    autoUpdater.signals.updateDownloaded((ev) => {
      (this._updateAvailable = true), (this._updateDownloaded = true);
      this.windowContext.sendToAllViews(
        IPC_EVENT_NAMES.APP_UPDATE_PROGRESS,
        null
      );
      this.windowContext.sendToAllViews(
        IPC_EVENT_NAMES.APP_UPDATE_DOWNLOADED,
        ev
      );
      if (this.isAutoUpdate) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
    autoUpdater.on("before-quit-for-update" as any, () => {
      this._updateQueuedForInstall = true;
    });
  }
  get isAutoUpdate() {
    return this.settingsInstance.instance.app.autoupdate && !isDevelopment;
  }
  AfterInit() {
    if (this._update) {
      this.windowContext.sendToAllViews(
        IPC_EVENT_NAMES.APP_UPDATE,
        this._update
      );
    }
    if (this.settingsInstance.instance.app.autoupdate && !isDevelopment)
      this.onCheckUpdate();
    else if (isDevelopment) this._checkUpdate();
  }
  @IpcHandle("action:app.getUpdate")
  async getUpdate() {
    return this._update;
  }
  @IpcHandle("action:app.installUpdate")
  @IpcOn("app.installUpdate", {
    debounce: 1000,
  })
  async onAutoUpdateRun() {
    if (!this.updateDownloaded && !this.updateQueuedForInstall) {
      const [downloadPromise] = this.onDownloadUpdate();
      await downloadPromise;
    }
    if (!this.isAutoUpdate) autoUpdater.quitAndInstall(false, true);
    return Promise.resolve();
  }
  private isUpdateInRange(ver: string) {
    if (isDevelopment) return true;
    return semver.gt(ver, this.app.getVersion(), {
      includePrerelease: true,
    });
  }
  private async _checkUpdate() {
    return await autoUpdater.checkForUpdates().then((x) => {
      if (!x?.updateInfo || !this.isUpdateInRange(x.updateInfo.version))
        throw new Error("No Update available");
      return x;
    });
  }
  private _downloadToken: CancellationToken;
  @IpcOn("app.downloadUpdate")
  onDownloadUpdate() {
    if (
      !this.updateAvailable ||
      this.updateDownloaded ||
      this.updateQueuedForInstall
    )
      return;
    this._downloadToken = new CancellationToken();
    return [
      autoUpdater.downloadUpdate(this._downloadToken),
      () => {
        this._downloadToken.cancel();
        this._downloadToken.dispose();
        this._downloadToken = null;
        this.windowContext.sendToAllViews(
          IPC_EVENT_NAMES.APP_UPDATE_PROGRESS,
          null
        );
      },
    ];
  }
  @IpcOn("app.downloadUpdateCancel")
  onDownloadUpdateCancel() {
    if (this._downloadToken) this._downloadToken.cancel();
  }
  @IpcHandle("action:app.checkUpdate")
  @IpcHandle("app.checkUpdate", {
    debounce: 1000,
  })
  onCheckUpdate() {
    return this._checkUpdate()
      .then((x) => {
        return dialog
          .showMessageBox(
            BrowserWindow.fromBrowserView(this.views.youtubeView),
            {
              title: `Update available (${x.updateInfo.version})`,
              message: `Hey there, there is a new version which you can update to.\n\n${
                process.platform === "win32"
                  ? x.updateInfo.releaseNotes
                  : x.updateInfo.releaseName
              }`,
              type: "question",
              buttons: ["Update now", "Cancel"],
              cancelId: -1,
            }
          )
          .then(({ response }) => {
            if (response === 0) {
              this.onAutoUpdateRun();
            }
          });
      })
      .catch((err: Error) => this.logger.error(err.message));
  }
  @IpcOn("settingsProvider.change", {
    debounce: 250,
    filter: (key: string) => key === "app.beta",
  })
  onBetaToggled(key, enabled: boolean) {
    autoUpdater.allowPrerelease = !!enabled;

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
