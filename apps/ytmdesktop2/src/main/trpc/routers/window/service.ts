import { AfterInit, BaseProvider, BeforeStart, OnDestroy, OnInit } from "@main/core/baseProvider";
import { isDevelopment } from "@main/infra/devUtils";
import { serverMain } from "@main/ipc/serverEvents";
import { getWindowState, getWindowStateFromContext, pushWindowStates } from "@main/windows/webContentUtils";
import { BrowserWindow, Event, IgnoreMouseEventsOptions, IpcMainEvent, IpcMainInvokeEvent, session } from "electron";
export const CSPDevHeaders = [
	`default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; media-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';`,
];
export default class WindowUtilsProvider extends BaseProvider implements AfterInit, OnInit, BeforeStart, OnDestroy {
	constructor() {
		super("window");
		this.bindIpc();
	}
	private bindIpc() {
		// Preload interactive elements send this channel (youtube chrome)
		serverMain.on("set-ignore-mouse-events", (event: IpcMainEvent, ignore: boolean, options: IgnoreMouseEventsOptions) =>
			this._toolbarMouseEvent(event, ignore, options),
		);
	}
	async BeforeStart() {}
	async OnInit() {
		if (isDevelopment)
			session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
				callback({
					responseHeaders: {
						...details.responseHeaders,
						"Content-Security-Policy": CSPDevHeaders,
					},
				});
			});
	}
	async _getWindowState(_ev: IpcMainInvokeEvent) {
		return this.getWindowStateForSender(_ev.sender);
	}

	async getWindowStateForSender(sender: Electron.WebContents) {
		try {
			const win = BrowserWindow.fromWebContents(sender)!;
			const state = getWindowState(win);
			if (!state) return state;
			return {
				...state,
				navigation:
					(this.views.youtubeView && {
						canGoBack: this.views.youtubeView.webContents.navigationHistory.canGoBack(),
						index: this.views.youtubeView.webContents.navigationHistory.getActiveIndex(),
					}) ||
					null,
			};
		} catch (ex) {
			this.logger.error(ex);
			return null;
		}
	}

	private _toolbarMouseEvent(event: IpcMainEvent, ignore: boolean, options: IgnoreMouseEventsOptions) {
		const win = BrowserWindow.fromWebContents(event.sender);
		win?.setIgnoreMouseEvents(ignore, options);
	}
	async _getMainWindowState(_ev: IpcMainInvokeEvent) {
		return this.getMainWindowState();
	}

	async getMainWindowState() {
		if (!this.windowContext) return null;
		try {
			const state = getWindowStateFromContext(this.windowContext);
			if (!state) return state;
			return state;
		} catch (ex) {
			this.logger.error(ex);
			return null;
		}
	}
	private _handleNavigation(_ev: Event, url: string) {
		pushWindowStates(this.views.youtubeView.webContents.id);
		this.logger.debug("navigation", { url });
	}
	async AfterInit() {
		// events will destroy anyways, dont bother unhandle
		this.views.youtubeView.webContents.on("will-navigate", this._handleNavigation.bind(this));
		this.views.youtubeView.webContents.on("did-navigate", this._handleNavigation.bind(this));
		this.views.youtubeView.webContents.on("did-navigate-in-page", this._handleNavigation.bind(this));
		this.logger.debug("Watching nav changes for window state...");
	}
	async OnDestroy() {}
}
