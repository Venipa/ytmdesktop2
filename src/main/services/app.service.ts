import { AfterInit, BaseProvider, BeforeStart } from "@main/utils/baseProvider";
import { IpcContext, IpcHandle, IpcOn } from "@main/utils/onIpcEvent";
import { setSentryEnabled } from "@main/utils/sentry";
import { App, BrowserWindow, IpcMainEvent } from "electron";

import { version as releaseVersion } from "node:os";
import { platform } from "@electron-toolkit/utils";
import { stripUndefined } from "@shared/utils/object";
import { clamp } from "lodash-es";
import { isDevelopment } from "../utils/devUtils";
import { serverMain } from "../utils/serverEvents";
import { createAppDialogWindow, createAppWindow } from "../utils/windowUtils";

const STATE_PAUSE_TIME = isDevelopment ? 5000 : 30e4; // dev: 5s, production: 5 minutes
const TEST_RESTART_NEEDED_DIALOG = isDevelopment && process.env.TEST_RESTART_NEEDED_DIALOG === "1";
@IpcContext
export default class AppProvider extends BaseProvider implements AfterInit, BeforeStart {
	private appLock: boolean = false;
	constructor(private _app: App) {
		super("app");
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
		if (platform.isLinux) this.app.commandLine.appendSwitch("gtk-version", "3");
		this.app.commandLine.appendSwitch("ozone-platform-hint", "auto");
		this.app.commandLine.appendSwitch("enable-features", "OverlayScrollbar,SharedArrayBuffer,UseOzonePlatform,WaylandWindowDecorations");

		// TODO: implement own shortcut handler for media keys
		// this.app.commandLine.appendSwitch("disable-features", "MediaSessionService");
	}
	async AfterInit() {
		this._app.on("browser-window-focus", this.windowFocus.bind(this));
		this._app.on("browser-window-blur", this.windowBlur.bind(this));

		if (TEST_RESTART_NEEDED_DIALOG) {
			this.handleRestartNeeded(null);
		}
	}
	private _blurTimestamp: Date | null = null;
	private _blurAfkHandle: any;
	private get isPlaying() {
		return !!this.getProvider("track")?.playing;
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
				return;
			}
			this.discord.disable();
		}, STATE_PAUSE_TIME);
	}
	private windowFocus() {
		if (!this._blurTimestamp) return;
		const isAway = Date.now() - this._blurTimestamp.getTime() > STATE_PAUSE_TIME;
		if (!isAway) return;
		this._blurTimestamp = null;
		clearTimeout(this._blurAfkHandle);
		this._blurAfkHandle = null;
		if (this.discord.settingsEnabled) this.discord.enable();
	}
	@IpcOn("settingsProvider.change", {
		filter: (key: string) => key === "app.enableStatisticsAndErrorTracing",
		debounce: 10000,
	})
	private __toggleSentryLogging(_key: string, value: boolean) {
		if (value) {
			setSentryEnabled(true);
		} else {
			setSentryEnabled(false);
		}
	}
	@IpcOn("subwindow.show/settingsWindow")
	private async __settingsWindowOpen(ev) {
		let settingsWindow = this.views.settingsWindow as any as BrowserWindow;
		try {
			if (!settingsWindow || settingsWindow.isDestroyed()) {
				settingsWindow = await createAppWindow({
					parent: this.windowContext.main,
					minimizeable: false,
				});
				settingsWindow.on("close", () => {
					this.windowContext.main.show();
				});
				this.windowContext.views.settingsWindow = settingsWindow as any;
			} else {
				settingsWindow.show();
			}
		} catch (err) {
			this.logger.error(err);
		}
	}
	@IpcOn("subwindow.show")
	private __onSubWindowOpen(_ev, windowName: string) {
		if (!windowName) {
			return;
		}
		const evName = "subwindow.show/" + windowName;
		if (serverMain.eventNames().includes(evName)) serverMain.emitServer("subwindow.show/" + windowName, _ev);
	}
	@IpcHandle("app.isWin11")
	async handleIsWin11() {
		return releaseVersion()?.toLowerCase().startsWith("windows 11");
	}
	private restartWindow: BrowserWindow | null = null;
	@IpcHandle("app.restartNeeded", {
		debounce: 1000,
	})
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
				this.restartWindow.close();
				this.restartWindow = null;
				if (action === "ok") {
					this.app.relaunch();
					this.app.exit();
				}
			},
		});
		this.restartWindow.show();
	}
	@IpcOn("subwindow.close")
	private __onSubWindowClose(_ev: IpcMainEvent, windowName?: string) {
		if (!windowName) {
			const wnd = BrowserWindow.fromWebContents(_ev.sender);
			wnd?.close?.();
			return;
		}
		const evName = "subwindow.close/" + windowName;
		if (serverMain.eventNames().includes(evName)) serverMain.emit("subwindow.close/" + windowName, _ev);
	}
}
