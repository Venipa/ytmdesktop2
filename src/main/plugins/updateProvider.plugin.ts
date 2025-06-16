import { AfterInit, BaseProvider, BeforeStart } from "@main/utils/baseProvider";
import { isDevelopment, isProduction } from "@main/utils/devUtils";
import { IpcContext, IpcHandle, IpcOn } from "@main/utils/onIpcEvent";
import { App, BrowserWindow } from "electron";
import { CancellationToken, UpdateInfo, autoUpdater } from "electron-updater";
import semver from "semver";

import { createAppWindow } from "@main/utils/windowUtils";
import { cacheWithFile } from "@shared/utils/filecache";
import { apiRepoUrl, authorName, compareUrlParse } from "@shared/utils/github";
import { clamp } from "lodash-es";
import IPC_EVENT_NAMES from "../utils/eventNames";
import SettingsProvider from "./settingsProvider.plugin";
const devShowUpdateDialog = isDevelopment && process.env.DEV_SHOW_UPDATE_DIALOG === "1";
if (isDevelopment) import.meta.env.__SKIP_BUILD == null;
const [GITHUB_AUTHOR, GITHUB_REPOSITORY] = import.meta.env.VITE_GITHUB_REPOSITORY.split("/", 2);
function getContent(content: string) {
	const lines = content.split("\n");
	const newContext = lines.map((line) => {
		if (line.startsWith("- ")) {
			const mainContent = line.split(";")[0];
			const context = line.split(";")[2] ?? "@" + authorName;
			const mentions = context
				?.split(" ")
				.filter((word) => word.startsWith("@"))
				.map((mention) => {
					const username = mention.replace("@", "");
					const avatarUrl = `https://github.com/${username}.png`;
					return `[![${mention}](${avatarUrl})](https://github.com/${username})`;
				});
			if (!mentions) {
				return line;
			}
			// Remove &nbsp
			return mainContent.replace(/&nbsp/g, "") + " – " + mentions.join(" ");
		} else if (compareUrlParse.test(line)) {
			return line.replace(compareUrlParse, `[View on Github]($1)`);
		}
		return line;
	});
	return newContext.join("\n");
}
@IpcContext
export default class UpdateProvider extends BaseProvider implements BeforeStart, AfterInit {
	private _update: UpdateInfo | null = null;
	private _updateAvailable: boolean = false;
	private _updateQueuedForInstall: boolean = false;
	private _updateDownloaded: boolean = false;
	private _downloadToken: CancellationToken | null = null;
	private _autoUpdateCheckHandle: NodeJS.Timeout | null = null;
	private _readyPromise: Promise<void> | null = null;
	private _downloadCachedPromise: Promise<void> | null = null;
	private _window: BrowserWindow;

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

	get window() {
		return this._window;
	}

	get isAutoUpdate() {
		return this.settingsInstance.instance.app.autoupdate && !isDevelopment;
	}

	// Private helper methods
	private isUpdateInRange(ver: string): boolean {
		if (devShowUpdateDialog) return true;
		return semver.gtr(ver, this.app.getVersion(), {
			includePrerelease: true,
			loose: true,
		});
	}
	private sendToAllViews(ev: string, ...args: any[]) {
		this.windowContext.sendToAllViews(ev, ...args);
		this.window?.webContents.send(ev, ...args);
	}

	private sendUpdateStatus(checking: boolean) {
		this.sendToAllViews(IPC_EVENT_NAMES.APP_UPDATE_CHECKING, checking);
	}
	private async parseUpdateInfo(ev: UpdateInfo) {
		const releaseNotes = await cacheWithFile(async () => {
			return await fetch(apiRepoUrl + `/releases/tags/v${ev.version}`)
				.then((res) => res.json())
				.then((res) => res.body)
				.then(getContent);
		}, `version-${ev.version}`);
		return {
			...ev,
			releaseNotes,
		};
	}
	private async handleUpdateAvailable(ev: UpdateInfo) {
		this._updateAvailable = ev && this.isUpdateInRange(ev.version);
		this.logger.debug(apiRepoUrl + `/releases/tags/v${ev.version}`);
		this._update = this._updateAvailable ? await this.parseUpdateInfo(ev) : (null as any);
		this.logger.debug("update available", "version: " + ev.version + "\n", "releaseNotes: \n" + this._update?.releaseNotes);

		if (this._updateAvailable) {
			this.sendToAllViews(IPC_EVENT_NAMES.APP_UPDATE, this._update);
		}
		this.sendUpdateStatus(false);
	}

	private async handleUpdateDownloaded(ev: UpdateInfo) {
		this._updateAvailable = true;
		this._updateDownloaded = true;
		this.sendToAllViews(IPC_EVENT_NAMES.APP_UPDATE_PROGRESS, null);
		this.sendToAllViews(IPC_EVENT_NAMES.APP_UPDATE_DOWNLOADED, await this.parseUpdateInfo(ev));

		if (this.isAutoUpdate) {
			autoUpdater.quitAndInstall(false, true);
		}
	}
	private _showUpdateDialogPromise: Promise<void> | null = null;
	private async showUpdateDialog(updateInfo: UpdateInfo) {
		if (this._showUpdateDialogPromise) {
			await this._showUpdateDialogPromise;
			return;
		}
		if (this.window?.isDestroyed()) this._window = null;
		if (this.window && this.window.isVisible()) {
			this.window.focus();
			return;
		}
		await (this._showUpdateDialogPromise = new Promise(async (resolve) => {
			const parent = this.windowContext.main;
			const height = clamp(parent.getBounds().height, 600, clamp(parent.getBounds().height - 48, 600, 800));
			this._window = await createAppWindow({
				path: "/update",
				height,
				width: 460,
				minWidth: 460,
				maxWidth: 460,
				minHeight: height,
				maxHeight: height,
				maximizeable: false,
				minimizeable: false,
				showTaskBar: true,
				parent,
				top: true,
				show: false,
			});
			resolve();
			this.window.webContents.on("did-finish-load", () => {
				this.window.webContents.send("app.update", { ...updateInfo });
			});
			this.window.on("closed", () => {
				this._window = null;
			});
			this.window.show();
		})).finally(() => {
			this._showUpdateDialogPromise = null;
		});
	}

	// Lifecycle methods
	BeforeStart() {
		autoUpdater.logger = this.logger;
		autoUpdater.setFeedURL({
			provider: "github",
			owner: GITHUB_AUTHOR,
			repo: GITHUB_REPOSITORY,
		});
		if (devShowUpdateDialog) autoUpdater.forceDevUpdateConfig = true;
		autoUpdater.autoDownload = false;
		autoUpdater.autoInstallOnAppQuit = isProduction;

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
				this.sendToAllViews(IPC_EVENT_NAMES.APP_UPDATE_PROGRESS, ev);
			}
		});

		autoUpdater.signals.updateDownloaded(this.handleUpdateDownloaded.bind(this));
		autoUpdater.on("before-quit-for-update" as any, () => {
			this._updateQueuedForInstall = true;
		});
		this._readyPromise = new Promise(async (resolve) => {
			await Promise.race([new Promise((r1) => autoUpdater.once("update-available", r1)), new Promise((r1) => autoUpdater.once("update-not-available", r1))]);
			resolve();
		});
		this._downloadCachedPromise = new Promise(async (resolve) => {
			await Promise.allSettled([new Promise((r1) => autoUpdater.once("update-downloaded", r1))]).finally(resolve);
		});
	}

	async AfterInit() {
		if (this._update) {
			this.sendToAllViews(IPC_EVENT_NAMES.APP_UPDATE, this._update);
		}

		if (this.isAutoUpdate) {
			this.onCheckUpdate().catch((err) => this.logger.error("Error checking for update", err));
		} else if (devShowUpdateDialog) {
			this.onCheckUpdate().catch((err) => this.logger.error("Error checking for update", err));
		}
	}

	// Public methods
	@IpcHandle("action:app.getUpdate")
	async getUpdate() {
		await this._readyPromise;
		this.logger.debug("getUpdate", this._update?.version);
		return this._update;
	}

	@IpcHandle("action:app.installUpdate")
	@IpcOn("app.installUpdate", { debounce: 1000 })
	async onAutoUpdateRun(quitAndInstall: boolean = true) {
		if (this._downloadToken) throw new Error("Download already in progress [E002]");
		if (!this.updateDownloaded && !this.updateQueuedForInstall) {
			const [downloadPromise] = this.onDownloadUpdate();
			if (!downloadPromise) return false;
			await downloadPromise;
		}
		if (devShowUpdateDialog || !quitAndInstall) return this._updateDownloaded;
		if (!this.isAutoUpdate || this.updateQueuedForInstall) autoUpdater.quitAndInstall(false, true);
		else if (this.updateDownloaded) autoUpdater.quitAndInstall(false, true);
		return this._updateDownloaded;
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
			autoUpdater
				.downloadUpdate(this._downloadToken)
				.then((files) => {
					this._updateDownloaded = !!files.length;
					return files;
				})
				.finally(() => {
					this._downloadToken?.dispose();
					this._downloadToken = null;
				}),
			() => {
				if (this._downloadToken) {
					this._downloadToken.cancel();
					this._downloadToken.dispose();
					this._downloadToken = null;
				}
				this.sendToAllViews(IPC_EVENT_NAMES.APP_UPDATE_PROGRESS, null);
			},
		];
	}

	@IpcOn("app.downloadUpdateCancel")
	onDownloadUpdateCancel() {
		if (this._downloadToken) {
			this._downloadToken.cancel();
		}
	}
	@IpcHandle("action:app.updateDownloaded")
	async isUpdateDownloaded() {
		await this._readyPromise;
		await this._downloadCachedPromise;
		return this.updateDownloaded;
	}
	private _c = 0;
	@IpcHandle("action:app.checkUpdate")
	@IpcHandle("app.checkUpdate", { debounce: 1000 })
	async onCheckUpdate() {
		try {
			const result = await this._checkUpdate();
			await this.showUpdateDialog(result.updateInfo);
		} catch (err: any) {
			this.logger.error(err.message);
		} finally {
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
