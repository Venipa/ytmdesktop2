import { AfterInit, BaseProvider, BeforeStart, OnDestroy, OnInit } from "@main/utils/baseProvider";
import { BrowserWindow, Event, IgnoreMouseEventsOptions, IpcMainEvent, IpcMainInvokeEvent, session } from "electron";
import { isDevelopment } from "../utils/devUtils";
import { IpcContext, IpcHandle, IpcOn } from "../utils/onIpcEvent";
import {
  getWindowState,
  getWindowStateFromContext,
  pushWindowStates,
} from "../utils/webContentUtils";
export const CSPDevHeaders = [
  `default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; media-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';`,
];
@IpcContext
export default class WindowUtilsProvider
  extends BaseProvider
  implements AfterInit, OnInit, BeforeStart, OnDestroy
{
  constructor() {
    super("window");
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
  @IpcHandle("windowState")
  async _getWindowState(_ev: IpcMainInvokeEvent) {
    try {
      const win = BrowserWindow.fromWebContents(_ev.sender)!;
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
  @IpcOn("toolbar/set-ignore-mouse-events")
  private _toolbarMouseEvent(event: IpcMainEvent, ignore: boolean, options: IgnoreMouseEventsOptions) {
    const win = BrowserWindow.fromWebContents(event.sender)
    win.setIgnoreMouseEvents(ignore, options)
  }
  @IpcHandle("mainWindowState")
  async _getMainWindowState(_ev: IpcMainInvokeEvent) {
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
    this.views.youtubeView.webContents.on(
      "did-navigate-in-page",
      this._handleNavigation.bind(this),
    );
    this.logger.debug("Watching nav changes for window state...");
  }
  async OnDestroy() {}
}
