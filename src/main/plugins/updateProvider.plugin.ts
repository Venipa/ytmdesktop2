import { AfterInit, BaseProvider, BeforeStart } from "@main/utils/baseProvider";
import { isDevelopment } from "@main/utils/devUtils";
import { IpcContext, IpcHandle, IpcOn } from "@main/utils/onIpcEvent";
import { App, dialog } from "electron";
import { CancellationToken, UpdateInfo, autoUpdater } from "electron-updater";
import semver from "semver";

import IPC_EVENT_NAMES from "../utils/eventNames";
import SettingsProvider from "./settingsProvider.plugin";

if (isDevelopment) import.meta.env.__SKIP_BUILD == null;
const [GITHUB_AUTHOR, GITHUB_REPOSITORY] = import.meta.env.VITE_GITHUB_REPOSITORY.split("/", 2);

@IpcContext
export default class UpdateProvider extends BaseProvider implements BeforeStart, AfterInit {
	private _update: UpdateInfo | null = null;
	private _updateAvailable: boolean = false;
	private _updateQueuedForInstall: boolean = false;
	private _updateDownloaded: boolean = false;
	private _downloadToken: CancellationToken | null = null;
	private _autoUpdateCheckHandle: NodeJS.Timeout | null = null;

	constructor(private app: App) {
		super("update");
	}

	get settingsInstance(): SettingsProvider {
		return this.getProvider("settings");
	}

	get updateQueuedForInstall() {
		return this._updateQueuedForInstall;
	}

	get updateAvailable() {
		return this._updateAvailable;
	}

	get updateDownloaded() {
		return this._updateDownloaded;
	}

	get isAutoUpdate() {
		return this.settingsInstance.instance.app.autoupdate && !isDevelopment;
	}

	// Private helper methods
	private isUpdateInRange(ver: string): boolean {
		if (isDevelopment) return true;
		return semver.gtr(ver, this.app.getVersion(), {
			includePrerelease: true,
		});
	}

	private sendUpdateStatus(checking: boolean) {
		this.windowContext.sendToAllViews(IPC_EVENT_NAMES.APP_UPDATE_CHECKING, checking);
	}

	private handleUpdateAvailable(ev: UpdateInfo) {
		this._updateAvailable = ev && this.isUpdateInRange(ev.version);
		this._update = this._updateAvailable ? ev : null;

		if (this._updateAvailable) {
			this.windowContext.sendToAllViews(IPC_EVENT_NAMES.APP_UPDATE, ev);
		}
		this.sendUpdateStatus(false);
	}

	private handleUpdateDownloaded(ev: UpdateInfo) {
		this._updateAvailable = true;
		this._updateDownloaded = true;
		this.windowContext.sendToAllViews(IPC_EVENT_NAMES.APP_UPDATE_PROGRESS, null);
		this.windowContext.sendToAllViews(IPC_EVENT_NAMES.APP_UPDATE_DOWNLOADED, ev);

		if (this.isAutoUpdate) {
			autoUpdater.quitAndInstall(false, true);
		}
	}

	private async showUpdateDialog(updateInfo: UpdateInfo) {
		const releaseNotes = (typeof updateInfo.releaseNotes === "string" ? updateInfo.releaseNotes : updateInfo.releaseNotes?.map((x) => x.note).join("\n"))
			?.replace(/<[^>]+>/g, "")
			.trimStart();

		const { response } = await dialog.showMessageBox(this.windowContext.main, {
			title: `Update available (${updateInfo.version})`,
			message: `Hey there, there is a new version which you can update to.\n\n${process.platform === "win32" ? releaseNotes : updateInfo.releaseName}`,
			type: "question",
			buttons: ["Update now", "Cancel"],
			cancelId: -1,
		});

		if (response === 0) {
			await this.onAutoUpdateRun();
		}
	}

	// Lifecycle methods
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

		// Event handlers
		autoUpdater.on("update-available", this.handleUpdateAvailable.bind(this));
		autoUpdater.on("update-not-available", () => this.sendUpdateStatus(false));
		autoUpdater.on("update-cancelled", () => this.sendUpdateStatus(false));
		autoUpdater.on("error", () => this.sendUpdateStatus(false));
		autoUpdater.on("checking-for-update", () => this.sendUpdateStatus(true));

		autoUpdater.on("download-progress", (ev) => {
			if (!this.updateDownloaded) {
				this.windowContext.sendToAllViews(IPC_EVENT_NAMES.APP_UPDATE_PROGRESS, ev);
			}
		});

		autoUpdater.signals.updateDownloaded(this.handleUpdateDownloaded.bind(this));
		autoUpdater.on("before-quit-for-update" as any, () => {
			this._updateQueuedForInstall = true;
		});
	}

	AfterInit() {
		if (this._update) {
			this.windowContext.sendToAllViews(IPC_EVENT_NAMES.APP_UPDATE, this._update);
		}

		if (this.isAutoUpdate) {
			this.onCheckUpdate().catch((err) => this.logger.error("Error checking for update", err));
		} else if (isDevelopment) {
			this._checkUpdate().catch((err) => this.logger.error("Error checking for update", err));
		}
	}

	// Public methods
	@IpcHandle("action:app.getUpdate")
	async getUpdate() {
		return this._update;
	}

	@IpcHandle("action:app.installUpdate")
	@IpcOn("app.installUpdate", { debounce: 1000 })
	async onAutoUpdateRun() {
		if (!this.updateDownloaded && !this.updateQueuedForInstall) {
			const [downloadPromise] = this.onDownloadUpdate();
			if (!downloadPromise) return;
			await downloadPromise;
		}
		if (!this.isAutoUpdate) autoUpdater.quitAndInstall(false, true);
	}

	private async _checkUpdate() {
		const beta = !!this.settingsInstance.instance?.app?.beta;
		autoUpdater.allowPrerelease = beta;

		const result = await autoUpdater.checkForUpdates();
		if (!result?.updateInfo || !this.isUpdateInRange(result.updateInfo.version)) {
			throw new Error("No Update available");
		}
		return result;
	}

	@IpcOn("app.downloadUpdate")
	onDownloadUpdate(): [Promise<string[]>, () => void] {
		if (!this.updateAvailable || this.updateDownloaded || this.updateQueuedForInstall) {
			return [] as any;
		}

		this._downloadToken = new CancellationToken();
		return [
			autoUpdater.downloadUpdate(this._downloadToken),
			() => {
				if (this._downloadToken) {
					this._downloadToken.cancel();
					this._downloadToken.dispose();
					this._downloadToken = null;
				}
				this.windowContext.sendToAllViews(IPC_EVENT_NAMES.APP_UPDATE_PROGRESS, null);
			},
		];
	}

	@IpcOn("app.downloadUpdateCancel")
	onDownloadUpdateCancel() {
		if (this._downloadToken) {
			this._downloadToken.cancel();
		}
	}

	@IpcHandle("action:app.checkUpdate")
	@IpcHandle("app.checkUpdate", { debounce: 1000 })
	async onCheckUpdate() {
		try {
			const result = await this._checkUpdate();
			await this.showUpdateDialog(result.updateInfo);
		} catch (err: any) {
			this.logger.error(err.message);
		}
	}

	@IpcOn("settingsProvider.change", {
		debounce: 250,
		filter: (key: string) => key === "app.beta",
	})
	onBetaToggled(key: string, enabled: boolean) {
		autoUpdater.allowPrerelease = !!enabled;
		this.onCheckUpdate();
	}

	@IpcOn("settingsProvider.change", {
		debounce: 250,
		filter: (key: string) => key === "app.autoupdate",
	})
	onAutoUpdateToggled(key: string, autoUpdateEnabled: boolean) {
		if (isDevelopment) return;

		if (autoUpdateEnabled && !this._autoUpdateCheckHandle) {
			this._autoUpdateCheckHandle = setInterval(() => this.onCheckUpdate(), 1000 * 60 * 15);
		} else if (!autoUpdateEnabled && this._autoUpdateCheckHandle) {
			clearInterval(this._autoUpdateCheckHandle);
			this._autoUpdateCheckHandle = null;
		}
	}
}
