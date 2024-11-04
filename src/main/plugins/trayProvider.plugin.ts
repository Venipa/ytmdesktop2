import { AfterInit, BaseProvider, OnDestroy } from "@main/utils/baseProvider";
import { IpcContext, IpcHandle, IpcOn } from "@main/utils/onIpcEvent";
import { createTrayMenu } from "@main/utils/trayMenu";
import { App, BrowserWindow, Tray } from "electron";

import TracIconPath from "~/build/favicon.ico?asset";
import { isDevelopment } from "../utils/devUtils";
import { createAppWindow } from "../utils/windowUtils";
import SettingsProvider from "./settingsProvider.plugin";

@IpcContext
export default class TrayProvider extends BaseProvider implements AfterInit, OnDestroy {
  get settingsInstance(): SettingsProvider {
    return this.getProvider("settings");
  }
  private _tray: Tray;
  get Tray() {
    return this._tray;
  }
  constructor(private app: App) {
    super("tray");
  }
  async AfterInit() {
    // todo, custom balloon player + info
  }

  private buildMenu() {
    return createTrayMenu(this);
  }
  async initializeTray() {
    if (this._tray && !this._tray.isDestroyed()) this._tray.destroy();
    this._tray = new Tray(TracIconPath);
    this._tray.setToolTip(`YouTube Music for Desktop`);
    this._tray.addListener("click", () =>
      BrowserWindow.fromWebContents(this.views.youtubeView.webContents)?.show(),
    );
    this._tray.setContextMenu(this.buildMenu());
    this._tray.setIgnoreDoubleClickEvents(true);
    this._tray.on("click", (ev) => {
      if (ev.triggeredByAccelerator)
        BrowserWindow.fromWebContents(this.views.youtubeView.webContents)?.show();
      // if (!ev.triggeredByAccelerator && isDevelopment) this.__trayWindow(); // todo
    });
    return this._tray;
  }
  @IpcOn("settingsProvider.change", {
    debounce: 50,
  })
  private onSettingsChange() {
    if (this._tray) this._tray.setContextMenu(this.buildMenu());
  }

  @IpcHandle("action:app.taskView")
  @IpcHandle("app.taskView")
  private async __trayWindow() {
    let mpId: number;
    let mpWindow = this.windowContext.views.taskViewWindow as any as BrowserWindow;
    if (!mpWindow || mpWindow.isDestroyed()) {
      const width = 400,
        height = 300;
      mpWindow = await createAppWindow({
        // parent: this.windowContext.main,
        path: "/taskview",
        minWidth: width,
        minHeight: height,
        height,
        width,
        maxHeight: height,
        maxWidth: width,
        showTaskBar: false,
        minimizeable: false,
        maximizeable: false,
      });
      mpWindow.setAlwaysOnTop(true, "pop-up-menu");
      mpWindow.setResizable(false);
      mpWindow.on("close", (ev) => {
        ev.preventDefault();
        mpWindow.hide();
      });
      if (!isDevelopment)
        mpWindow.on("blur", () => {
          mpWindow.close();
        });

      mpWindow.webContents.on("before-input-event", (ev, input) => {
        if (input.key === "esc") mpWindow.close();
      });
      const trayBounds = this._tray.getBounds();
      mpWindow.setBounds({
        x: trayBounds.x + trayBounds.width - width,
        y: trayBounds.y + trayBounds.height - height,
        height,
        width,
      });
      this.windowContext.views.taskViewWindow = mpWindow as any;
      mpId = mpWindow.id;
    } else {
      mpId = mpWindow.id;
      mpWindow.show();
      // mpWindow.destroy();
    }
    this.windowContext.sendToAllViews(
      "taskview.state",
      !this.views.taskViewWindow ? null : { active: false },
    );
    return mpId;
  }
  async OnDestroy() {
    (this.views.taskViewWindow as any as BrowserWindow)?.destroy();
  }
}
