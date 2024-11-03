import { AfterInit, BaseProvider, BeforeStart, OnInit } from "@/app/utils/baseProvider";
import { App, BrowserWindow, IpcMainInvokeEvent, session } from "electron";
import { isDevelopment } from "../utils/devUtils";
import { IpcContext, IpcHandle } from "../utils/onIpcEvent";
import { getWindowState, getWindowStateFromContext } from "../utils/webContentUtils";
export const CSPDevHeaders = [
  `default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; media-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';`
];
@IpcContext
export default class WindowUtilsProvider extends BaseProvider implements AfterInit, OnInit, BeforeStart {
  constructor() {
    super("window");
  }
  async BeforeStart() {
  }
  async OnInit(app?: App) {
    if (isDevelopment)
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': CSPDevHeaders
          }
        })
      })
  }
  @IpcHandle("windowState")
  async _getWindowState(_ev: IpcMainInvokeEvent) {
    try {
      const win = BrowserWindow.fromWebContents(_ev.sender);
      const state = getWindowState(win)
      if (!state) return state;
      return {
        ...state,
        navigation: this.views.youtubeView && { canGoBack: this.views.youtubeView.webContents.navigationHistory.canGoBack(), index: this.views.youtubeView.webContents.navigationHistory.getActiveIndex() } || null
      };
    } catch (ex) {
      this.logger.error(ex)
      return null;
    }
  }
  @IpcHandle("mainWindowState")
  async _getMainWindowState(_ev: IpcMainInvokeEvent) {
    try {
      const state = getWindowStateFromContext(this.windowContext)
      if (!state) return state;
      return state
    } catch (ex) {
      this.logger.error(ex)
      return null;
    }
  }

  async AfterInit() {

  }
}
