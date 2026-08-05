import { version as releaseVersion } from "node:os";
import { AfterInit, BaseProvider, BeforeStart } from "@main/core/baseProvider";
import { isDevelopment } from "@main/infra/devUtils";
import { setSentryEnabled } from "@main/infra/sentry";
import { serverMain } from "@main/ipc/serverEvents";
import { trackService } from "@main/trpc/routers/track";
import { createAppDialogWindow, createAppWindow } from "@main/windows/windowUtils";
import { stripUndefined } from "@shared/utils/object";
import { App, BrowserWindow, IpcMainEvent, IpcMainInvokeEvent, shell } from "electron";
import { clamp, debounce } from "lodash-es";

const STATE_PAUSE_TIME = 30e4;
const TEST_RESTART_NEEDED_DIALOG = isDevelopment && process.env.TEST_RESTART_NEEDED_DIALOG === "1";

export default class AppProvider extends BaseProvider implements AfterInit, BeforeStart {
	private appLock: boolean = false;
	private settingsWindowOpenPromise: Promise<BrowserWindow> | null = null;
	private _windowMap = new Map<string, BrowserWindow>();
	private restartWindow: BrowserWindow | null = null;
	private _blurTimestamp: Date | null = null;
	private _blurAfkHandle: any;

	constructor(private _app: App) {
		super("app");
		// Preload / youtube plugins still use raw IPC for these; React uses tRPC → public methods.
		this.bindPreloadIpc();
	}

	/** Narrow IPC surface for youtube/preload only — prefer public methods + tRPC elsewhere. */
	private bindPreloadIpc() {
		serverMain.on("subwindow.show", (_ev, windowName: string) => void this.openSubWindow(windowName));
		serverMain.on("subwindow.close", (ev: IpcMainEvent, windowName?: string) => this.closeSubWindow(ev, windowName));
		serverMain.handle(
			"app.restartNeeded",
			debounce((ev, opts) => this.handleRestartNeeded(ev, opts), 1000),
		);
		serverMain.handle(
			"action:app.restartNeeded",
			debounce((ev, opts) => this.handleRestartNeeded(ev, opts), 1000),
		);
	}

	get app() {
		return this._app;
	}

	async BeforeStart() {
		if (process.platform !== "darwin") {
			this.appLock = this._app.requestSingleInstanceLock();
			if (!this.appLock) {
				this.app.exit();
			} else {
				this.app.on("second-instance", () => {
					const wnd = this.windowContext.main;
					if (!wnd) return;
					if (wnd.isMinimized()) wnd.restore();
					if (!wnd.isVisible()) {
						wnd.show();
						wnd.setSkipTaskbar(false);
					}
					wnd.focus();
				});
			}
		}
		this.app.commandLine.appendSwitch("ozone-platform-hint", "auto");
	}

	async AfterInit() {
		this._app.on("browser-window-focus", this.windowFocus.bind(this));
		this._app.on("browser-window-blur", this.windowBlur.bind(this));

		this.getProvider("settings").onSettingChange(
			"app.enableStatisticsAndErrorTracing",
			(value) => this.__toggleSentryLogging("app.enableStatisticsAndErrorTracing", !!value),
			{ debounce: 10000 },
		);

		if (TEST_RESTART_NEEDED_DIALOG) {
			void this.handleRestartNeeded(null);
		}
	}

	private get isPlaying() {
		return !!trackService.playing;
	}
	private get discord() {
		return this.getProvider("discord");
	}

	private windowBlur() {
		if (this.isPlaying) return;
		this._blurTimestamp = new Date();
		this._blurAfkHandle = setTimeout(() => {
			if (this.isPlaying) {
				this._blurTimestamp = new Date();
				this.windowFocus();
			} else {
				this.discord.disable();
			}
		}, STATE_PAUSE_TIME);
	}

	private windowFocus() {
		if (!this._blurTimestamp) return;
		const elapsedSinceBlur = Date.now() - this._blurTimestamp.getTime();
		if (elapsedSinceBlur <= STATE_PAUSE_TIME) return;
		this._blurTimestamp = null;
		if (this._blurAfkHandle) {
			clearTimeout(this._blurAfkHandle);
			this._blurAfkHandle = null;
		}
		if (this.discord.settingsEnabled && !this.discord.isConnected) void this.discord.enable();
	}

	private __toggleSentryLogging(_key: string, value: boolean) {
		setSentryEnabled(!!value);
	}

	/** Open / focus settings BrowserWindow. */
	async openSettingsWindow() {
		let settingsWindow = this.views.settingsWindow as any as BrowserWindow;
		try {
			if (settingsWindow && !settingsWindow.isDestroyed()) {
				settingsWindow.show();
				return settingsWindow;
			}
			if (this.settingsWindowOpenPromise) {
				return await this.settingsWindowOpenPromise;
			}
			this.settingsWindowOpenPromise = createAppWindow({
				parent: this.windowContext.main,
				minimizeable: false,
			}).then((win) => {
				win.on("close", () => {
					this.windowContext.main.show();
				});
				this.windowContext.views.settingsWindow = win as any;
				return win;
			});
			return await this.settingsWindowOpenPromise;
		} catch (err) {
			this.logger.error(err);
			return null;
		} finally {
			this.settingsWindowOpenPromise = null;
		}
	}

	/** Open named subwindow (`settingsWindow` or hash route name). */
	async openSubWindow(windowName: string) {
		if (!windowName) return;
		if (windowName === "settingsWindow") {
			await this.openSettingsWindow();
			return;
		}
		if (this._windowMap.has(windowName)) {
			const window = this._windowMap.get(windowName);
			if (window) {
				if (window.isMinimized()) window.restore();
				if (!window.isVisible()) {
					window.show();
					window.setSkipTaskbar(false);
				} else window.show();
				return;
			}
		}
		const window = await createAppWindow({ parent: this.windowContext.main, path: "/" + windowName });
		this._windowMap.set(windowName, window);
	}

	closeSubWindow(_ev?: IpcMainEvent | null, windowName?: string) {
		if (!windowName) {
			const wnd = _ev?.sender ? BrowserWindow.fromWebContents(_ev.sender) : null;
			wnd?.close?.();
			return;
		}
		const mapped = this._windowMap.get(windowName);
		if (mapped && !mapped.isDestroyed()) {
			mapped.close();
			this._windowMap.delete(windowName);
			return;
		}
		if (windowName === "settingsWindow") {
			const settingsWindow = this.views.settingsWindow as any as BrowserWindow;
			settingsWindow?.close?.();
		}
	}

	async handleIsWin11() {
		return releaseVersion()?.toLowerCase().startsWith("windows 11");
	}

	async handleRestartNeeded(ev: unknown, { message, icon }: { message?: string; icon?: string } = {}) {
		if (this.restartWindow) {
			this.restartWindow.show();
			return;
		}
		const parent = this.windowContext.main;
		const parentHeight = parent.getBounds().height;
		const height = clamp(parentHeight, 300, clamp(parentHeight - 48, 300, 300));
		this.restartWindow = await createAppDialogWindow({
			parent: this.windowContext.main,
			path: ["/restart?", new URLSearchParams(stripUndefined({ message, icon })).toString()].filter(Boolean).join(""),
			height,
			width: 400,
			minWidth: 400,
			maxWidth: 400,
			minHeight: height,
			maxHeight: height,
			maximizeable: false,
			minimizeable: false,
			showTaskBar: true,
			top: true,
			show: false,
			onResponse: (action) => {
				this.logger.debug("restartWindow response", action);
				this.restartWindow?.close();
				this.restartWindow = null;
				if (action === "ok") {
					this.app.relaunch();
					this.app.exit();
				}
			},
		});
		this.restartWindow.show();
	}

	async handleOpenFile(ev: IpcMainInvokeEvent, path: string) {
		const errorMessage = await shell.openPath(path);
		if (errorMessage) {
			this.logger.error("Failed to open file", errorMessage);
			return false;
		}
		return true;
	}
}
