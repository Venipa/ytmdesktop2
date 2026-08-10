import { EventEmitter } from "node:events";
import { AfterInit, BaseProvider, BeforeStart } from "@main/core/baseProvider";
import { isDevelopment, isProduction } from "@main/infra/devUtils";
import SettingsProvider from "@main/trpc/routers/settings/service";
import { createAppWindow } from "@main/windows/windowUtils";
import { cacheWithFile } from "@shared/utils/filecache";
import { githubRepoFetch } from "@shared/utils/github";
import type { GithubRelease } from "@shared/utils/github";
import type { ProgressInfo, ReleaseNoteEntry, UpdateChannel, UpdateInfo } from "@shared/utils/updater";
import {
	electronUpdaterChannelFor,
	isVersionAllowedOnChannel,
	parseUpdateChannel,
} from "@shared/utils/updater";
import { observable } from "@trpc/server/observable";
import { App, BrowserWindow } from "electron";
import { autoUpdater, CancellationToken, type UpdateInfo as ElectronUpdateInfo } from "electron-updater";
import { clamp } from "lodash-es";
import semver from "semver";

const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 15;
const GITHUB_FEED = (() => {
	const [owner, repo] = String(import.meta.env.VITE_GITHUB_REPOSITORY ?? "").split("/", 2);
	return { owner, repo };
})();

const devShowUpdateDialog = isDevelopment && process.env.DEV_SHOW_UPDATE_DIALOG === "1";

type UpdateEvents = {
	update: [UpdateInfo | null];
	checking: [boolean];
	progress: [ProgressInfo | null];
	downloaded: [UpdateInfo | null];
};

const events = new EventEmitter() as EventEmitter & {
	on<K extends keyof UpdateEvents>(event: K, listener: (...args: UpdateEvents[K]) => void): EventEmitter;
	off<K extends keyof UpdateEvents>(event: K, listener: (...args: UpdateEvents[K]) => void): EventEmitter;
	emit<K extends keyof UpdateEvents>(event: K, ...args: UpdateEvents[K]): boolean;
};

type GithubReleaseJson = GithubRelease;

function cleanVersion(raw: string): string | null {
	const cleaned = semver.clean(raw.replace(/^v/i, ""), { loose: true });
	return cleaned;
}

function stripHtml(value: string): string {
	return value
		.replace(/<\/p>/gi, "\n\n")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<li>/gi, "- ")
		.replace(/<\/li>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.trim();
}

function noteFromFeed(notes: ElectronUpdateInfo["releaseNotes"], version: string): string | null {
	if (!notes) return null;
	if (typeof notes === "string") {
		const trimmed = notes.trim();
		if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
		return /^\s*</.test(trimmed) ? stripHtml(trimmed) : trimmed;
	}
	if (Array.isArray(notes)) {
		const match = notes.find((entry) => "version" in entry && cleanVersion(String(entry.version)) === cleanVersion(version));
		const note = match && "note" in match ? match.note : null;
		if (!note?.trim()) return null;
		return /^\s*</.test(note) ? stripHtml(note) : note.trim();
	}
	return null;
}

async function fetchGithubReleaseRange(options: {
	currentVersion: string;
	targetVersion: string;
	channel: UpdateChannel;
}): Promise<ReleaseNoteEntry[]> {
	const current = cleanVersion(options.currentVersion) ?? options.currentVersion;
	const target = cleanVersion(options.targetVersion) ?? options.targetVersion;

	try {
		const raw = await cacheWithFile(async () => {
			const { data, error } = await githubRepoFetch<GithubReleaseJson[]>("/releases", {
				query: { per_page: 50 },
			});
			if (error) throw new Error(`GitHub releases: ${error.status}`);
			return data ?? [];
		}, `releases-${options.channel}-${target}-gt-${current}`);

		const entries: ReleaseNoteEntry[] = [];
		for (const release of raw) {
			if (release.draft) continue;
			const version = cleanVersion(release.tag_name ?? "");
			if (!version) continue;

			// Stable channel: GitHub non-prerelease only.
			if (options.channel === "stable" && release.prerelease) continue;
			if (!isVersionAllowedOnChannel(version, options.channel)) continue;

			try {
				if (!semver.gt(version, current, { loose: true })) continue;
				if (!semver.lte(version, target, { loose: true })) continue;
			} catch {
				continue;
			}
			entries.push({
				version,
				name: release.name?.replace(new RegExp(`^v?${version}\\s*-?\\s*`, "i"), "").trim() || null,
				body: release.body?.trim() || null,
				publishedAt: release.published_at ?? null,
			});
		}

		return entries.sort((a, b) => semver.rcompare(a.version, b.version, { loose: true }));
	} catch {
		return [];
	}
}

async function toAppUpdateInfo(
	info: ElectronUpdateInfo,
	options: { currentVersion: string; channel: UpdateChannel },
): Promise<UpdateInfo> {
	let releases = await fetchGithubReleaseRange({
		currentVersion: options.currentVersion,
		targetVersion: info.version,
		channel: options.channel,
	});

	// Ensure the target version always appears, even if GitHub list miss it.
	const target = cleanVersion(info.version) ?? info.version;
	if (!releases.some((entry) => entry.version === target)) {
		const body = noteFromFeed(info.releaseNotes, info.version);
		releases = [
			{
				version: target,
				name: info.releaseName ?? null,
				body,
				publishedAt: info.releaseDate ?? null,
			},
			...releases,
		].sort((a, b) => semver.rcompare(a.version, b.version, { loose: true }));
	} else {
		// Fill empty bodies from feed note when possible.
		releases = releases.map((entry) => {
			if (entry.body) return entry;
			const body = noteFromFeed(info.releaseNotes, entry.version);
			return body ? { ...entry, body } : entry;
		});
	}

	const latest = releases[0] ?? null;

	return {
		version: info.version,
		releaseName: info.releaseName ?? latest?.name ?? null,
		releaseNotes: latest?.body ?? null,
		releases,
		releaseDate: info.releaseDate,
	};
}

export default class UpdateProvider extends BaseProvider implements BeforeStart, AfterInit {
	private _update: UpdateInfo | null = null;
	private _updateAvailable = false;
	private _updateQueuedForInstall = false;
	private _updateDownloaded = false;
	private _checking = false;
	private _progress: ProgressInfo | null = null;
	private _downloadToken: CancellationToken | null = null;
	private _autoUpdateCheckHandle: NodeJS.Timeout | null = null;
	private _window: BrowserWindow | null = null;
	private _showUpdateDialogPromise: Promise<void> | null = null;
	private _ignoreUpdaterEvents = false;
	/** After "Later" / closing the update window, skip auto dialogs until next app launch. */
	private _suppressDialogUntilRestart = false;

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

	get updateInfo() {
		return this._update;
	}

	get isAutoUpdate() {
		return this.settingsInstance.instance.app.autoupdate && !isDevelopment;
	}

	private getChannel(): UpdateChannel {
		return parseUpdateChannel(this.settingsInstance.get("app.channel"));
	}

	/** Sync electron-updater flags for a specific channel probe. */
	private applyUpdaterFeed(channel: UpdateChannel) {
		const allowPre = channel !== "stable";
		autoUpdater.allowPrerelease = allowPre;
		autoUpdater.channel = electronUpdaterChannelFor(channel);
		this.logger.debug("applyUpdaterFeed", { channel, allowPrerelease: allowPre, feedChannel: autoUpdater.channel });
	}

	/** Sync feed to the user's selected channel. */
	private applyUpdateChannel() {
		this.applyUpdaterFeed(this.getChannel());
	}

	/** Drop offered/downloaded update so channel switches cannot install the wrong build. */
	private clearPendingUpdate(reason: string) {
		this.logger.debug("clearPendingUpdate", { reason });
		this.onDownloadUpdateCancel();
		this._updateDownloaded = false;
		this._updateQueuedForInstall = false;
		this.setProgress(null);
		this.setUpdate(null, false);
	}

	private isUpdateInRange(ver: string, channel: UpdateChannel = this.getChannel()): boolean {
		this.logger.debug("isUpdateInRange", { newVersion: ver, currentVersion: this.app.getVersion(), channel });
		if (devShowUpdateDialog) return true;
		if (!isVersionAllowedOnChannel(ver, channel)) {
			this.logger.debug("Reject update — not allowed on channel", { ver, channel });
			return false;
		}
		try {
			return semver.gtr(ver, this.app.getVersion(), {
				includePrerelease: channel !== "stable",
				loose: true,
			});
		} catch (err) {
			this.logger.error("Error checking if update is in range", err);
			return false;
		}
	}

	private setChecking(checking: boolean) {
		this._checking = checking;
		events.emit("checking", checking);
	}

	private setProgress(progress: ProgressInfo | null) {
		this._progress = progress;
		events.emit("progress", progress);
	}

	private setUpdate(info: UpdateInfo | null, available = !!info) {
		this._update = info;
		this._updateAvailable = available;
		events.emit("update", info);
	}

	private setDownloaded(info: UpdateInfo | null) {
		this._updateDownloaded = !!info;
		if (info) this.setUpdate(info, true);
		this.setProgress(null);
		events.emit("downloaded", info);
	}

	private resolveUpdateInfo(ev: ElectronUpdateInfo) {
		return toAppUpdateInfo(ev, {
			currentVersion: this.app.getVersion(),
			channel: this.getChannel(),
		});
	}

	private async handleUpdateAvailable(ev: ElectronUpdateInfo) {
		if (this._ignoreUpdaterEvents) return;
		this.logger.debug("handleUpdateAvailable", { version: ev.version });
		const inRange = this.isUpdateInRange(ev.version);
		if (!inRange) {
			this.setUpdate(null, false);
			this.setChecking(false);
			return;
		}
		this.setUpdate(await this.resolveUpdateInfo(ev), true);
		this.setChecking(false);
	}

	private async handleUpdateDownloaded(ev: ElectronUpdateInfo) {
		if (this._ignoreUpdaterEvents) return;
		this.setDownloaded(await this.resolveUpdateInfo(ev));
		if (this.isAutoUpdate) this.quitAndInstall();
	}

	/** User dismissed update UI ("Later" / close). Auto prompts wait until next launch. */
	dismissUpdateDialog() {
		this._suppressDialogUntilRestart = true;
		this.logger.debug("dismissUpdateDialog", { suppressUntilRestart: true });
		if (this._window && !this._window.isDestroyed()) {
			this._window.close();
			return true;
		}
		return false;
	}

	private async showUpdateDialog(updateInfo: UpdateInfo | null = this._update, options: { force?: boolean } = {}) {
		if (this._suppressDialogUntilRestart && !options.force) {
			this.logger.debug("showUpdateDialog skipped — dismissed until restart");
			return;
		}
		if (this._showUpdateDialogPromise) {
			await this._showUpdateDialogPromise;
			return;
		}
		if (this._window?.isDestroyed()) this._window = null;
		if (this._window?.isVisible()) {
			this._window.focus();
			if (updateInfo) this.setUpdate(updateInfo, true);
			return;
		}

		this._showUpdateDialogPromise = (async () => {
			const parent = this.windowContext.main;
			const { width: parentWidth, height: parentHeight } = parent.getBounds();
			const width = clamp(parentWidth, 600, 800);
			const height = clamp(Math.round(parentHeight * 0.45), 400, 480);
			this._window = await createAppWindow({
				path: "/update",
				height,
				width,
				minWidth: 600,
				maxWidth: 800,
				minHeight: 400,
				maxHeight: 480,
				maximizeable: false,
				minimizeable: false,
				showTaskBar: true,
				parent,
				top: true,
				show: false,
			});
			this._window.webContents.on("did-finish-load", () => {
				if (updateInfo) this.setUpdate(updateInfo, true);
				else events.emit("update", this._update);
			});
			this._window.on("closed", () => {
				// Closing the update window (Later / X) snoozes auto prompts for this session.
				this._suppressDialogUntilRestart = true;
				this._window = null;
			});
			this._window.show();
		})().finally(() => {
			this._showUpdateDialogPromise = null;
		});

		await this._showUpdateDialogPromise;
	}

	BeforeStart() {
		autoUpdater.logger = this.logger;
		autoUpdater.setFeedURL({
			provider: "github",
			owner: GITHUB_FEED.owner,
			repo: GITHUB_FEED.repo,
		});
		if (devShowUpdateDialog) autoUpdater.forceDevUpdateConfig = true;
		autoUpdater.autoDownload = false;
		autoUpdater.autoInstallOnAppQuit = isProduction;
		autoUpdater.fullChangelog = false;
		this.applyUpdateChannel();

		this.logger.debug(autoUpdater.updateConfigPath);
		this.logger.debug("Updater Cache: " + (autoUpdater as unknown as { app: { baseCachePath: string } }).app.baseCachePath);

		autoUpdater.on("update-available", (info) => void this.handleUpdateAvailable(info));
		autoUpdater.on("update-not-available", () => {
			if (this._ignoreUpdaterEvents) return;
			this.setUpdate(null, false);
			this.setChecking(false);
		});
		autoUpdater.on("update-cancelled", () => {
			if (this._ignoreUpdaterEvents) return;
			this.setChecking(false);
		});
		autoUpdater.on("error", (err) => {
			if (this._ignoreUpdaterEvents) return;
			this.logger.error("Updater error", err);
			this.setChecking(false);
			this.setProgress(null);
		});
		autoUpdater.on("checking-for-update", () => {
			if (this._ignoreUpdaterEvents) return;
			this.setChecking(true);
		});
		autoUpdater.on("download-progress", (ev) => {
			if (!this._updateDownloaded) this.setProgress(ev);
		});
		autoUpdater.signals.updateDownloaded((info) => void this.handleUpdateDownloaded(info));
		(autoUpdater as typeof autoUpdater & { on(event: "before-quit-for-update", listener: () => void): typeof autoUpdater }).on(
			"before-quit-for-update",
			() => {
				this._updateQueuedForInstall = true;
			},
		);
	}

	async AfterInit() {
		this.settingsInstance.onSettingChange("app.channel", () => this.onChannelChanged(), { debounce: 250 });
		this.settingsInstance.onSettingChange("app.autoupdate", (enabled) => this.onAutoUpdateToggled(!!enabled), {
			debounce: 250,
		});

		if (this._update) this.setUpdate(this._update, true);

		if (this.isAutoUpdate || devShowUpdateDialog) {
			void this.onCheckUpdate().catch((err) => this.logger.error("Error checking for update", err));
		}

		if (this.isAutoUpdate) this.onAutoUpdateToggled(true);
	}

	getUpdate() {
		return this._update;
	}

	isUpdateDownloaded() {
		return this._updateDownloaded;
	}

	getProgress() {
		return this._progress;
	}

	isChecking() {
		return this._checking;
	}

	private quitAndInstall() {
		this._updateQueuedForInstall = true;
		autoUpdater.quitAndInstall(false, true);
	}

	async onAutoUpdateRun(_ev: unknown = null, quitAndInstall = true) {
		if (this._downloadToken) throw new Error("Download already in progress [E002]");
		if (!this._updateDownloaded && !this._updateQueuedForInstall) {
			const [downloadPromise] = this.onDownloadUpdate();
			if (!downloadPromise) return false;
			await downloadPromise;
		}
		if (!quitAndInstall) return this._updateDownloaded;
		if (!this.isAutoUpdate || this._updateQueuedForInstall) this.quitAndInstall();
		else if (this._updateDownloaded) this.quitAndInstall();
		return this._updateDownloaded;
	}

	/**
	 * Probe the selected channel feed, and for beta/alpha also probe stable so a
	 * newer stable release always wins over an older pre-release.
	 */
	private async resolveBestUpdate(): Promise<ElectronUpdateInfo | null> {
		const channel = this.getChannel();
		const candidates: ElectronUpdateInfo[] = [];

		const probe = async (feed: UpdateChannel) => {
			this.applyUpdaterFeed(feed);
			try {
				const result = await autoUpdater.checkForUpdates();
				const info = result?.updateInfo;
				if (info && this.isUpdateInRange(info.version, channel)) {
					candidates.push(info);
				}
			} catch (err) {
				this.logger.debug("Channel probe failed", { feed, err: err instanceof Error ? err.message : err });
			}
		};

		await probe(channel);
		if (channel !== "stable") {
			await probe("stable");
		}

		this.applyUpdateChannel();

		if (!candidates.length) return null;
		candidates.sort((a, b) => {
			const av = cleanVersion(a.version) ?? a.version;
			const bv = cleanVersion(b.version) ?? b.version;
			return semver.rcompare(av, bv, { loose: true });
		});
		return candidates[0] ?? null;
	}

	private async _checkUpdate() {
		this.setChecking(true);
		this._ignoreUpdaterEvents = true;
		try {
			const best = await this.resolveBestUpdate();
			if (!best) {
				this.setUpdate(null, false);
				throw new Error("No Update available");
			}
			const info = await this.resolveUpdateInfo(best);
			this.setUpdate(info, true);
			return { updateInfo: info };
		} finally {
			this._ignoreUpdaterEvents = false;
			this.applyUpdateChannel();
			this.setChecking(false);
		}
	}

	onDownloadUpdate(): [Promise<string[]> | null, (() => void) | null] {
		if (!this._updateAvailable || this._updateDownloaded || this._updateQueuedForInstall) {
			return [null, null];
		}

		this._downloadToken = new CancellationToken();
		this.setProgress({ total: 0, delta: 0, transferred: 0, percent: 0, bytesPerSecond: 0 });

		const promise = autoUpdater
			.downloadUpdate(this._downloadToken)
			.then((files) => {
				this._updateDownloaded = !!files.length;
				return files;
			})
			.finally(() => {
				this._downloadToken?.dispose();
				this._downloadToken = null;
			});

		const cancel = () => {
			if (!this._downloadToken) return;
			this._downloadToken.cancel();
			this._downloadToken.dispose();
			this._downloadToken = null;
			this.setProgress(null);
		};

		return [promise, cancel];
	}

	onDownloadUpdateCancel() {
		if (!this._downloadToken) return false;
		this._downloadToken.cancel();
		this._downloadToken.dispose();
		this._downloadToken = null;
		this.setProgress(null);
		return true;
	}

	async onCheckUpdate(options: { showDialog?: boolean; forceDialog?: boolean } = {}) {
		const showDialog = options.showDialog ?? true;
		const forceDialog = options.forceDialog ?? false;
		try {
			const result = await this._checkUpdate();
			if (showDialog && result.updateInfo) {
				await this.showUpdateDialog(result.updateInfo, { force: forceDialog });
			}
			return result.updateInfo;
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			this.logger.error(message);
			return null;
		}
	}

	onChannelChanged() {
		const channel = this.getChannel();
		this.logger.debug("onChannelChanged", { channel });
		this.applyUpdateChannel();
		this.clearPendingUpdate("channel-change");
		void this.onCheckUpdate({ showDialog: false }).catch((err) => this.logger.error("Channel change recheck failed", err));
	}

	onAutoUpdateToggled(autoUpdateEnabled: boolean) {
		if (isDevelopment) return;

		if (autoUpdateEnabled && !this._autoUpdateCheckHandle) {
			this._autoUpdateCheckHandle = setInterval(() => void this.onCheckUpdate({ showDialog: true }), UPDATE_CHECK_INTERVAL_MS);
		} else if (!autoUpdateEnabled && this._autoUpdateCheckHandle) {
			clearInterval(this._autoUpdateCheckHandle);
			this._autoUpdateCheckHandle = null;
		}
	}

	/** tRPC subscription — service EventEmitter. */
	subscribeUpdate() {
		return observable<UpdateInfo | null>((emit) => {
			const handler = (info: UpdateInfo | null) => emit.next(info);
			events.on("update", handler);
			emit.next(this._update);
			return () => {
				events.off("update", handler);
			};
		});
	}

	subscribeChecking() {
		return observable<boolean>((emit) => {
			const handler = (checking: boolean) => emit.next(checking);
			events.on("checking", handler);
			emit.next(this._checking);
			return () => {
				events.off("checking", handler);
			};
		});
	}

	subscribeProgress() {
		return observable<ProgressInfo | null>((emit) => {
			const handler = (progress: ProgressInfo | null) => emit.next(progress);
			events.on("progress", handler);
			emit.next(this._progress);
			return () => {
				events.off("progress", handler);
			};
		});
	}

	subscribeDownloaded() {
		return observable<UpdateInfo | null>((emit) => {
			const handler = (info: UpdateInfo | null) => emit.next(info);
			events.on("downloaded", handler);
			if (this._updateDownloaded && this._update) emit.next(this._update);
			return () => {
				events.off("downloaded", handler);
			};
		});
	}
}
