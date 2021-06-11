import { App, ipcMain } from "electron";
import { IpcContext, IpcOn } from "../utils/onIpcEvent";
import fs from "fs";
import path from "path";
import SettingsProvider from "./settingsProvider.plugin";
import { BaseProvider, AfterInit } from "../utils/baseProvider";
import { rootWindowInjectCustomCss } from "../utils/webContentUtils";
@IpcContext
export default class EventProvider extends BaseProvider implements AfterInit {
  private scssUpdateHandler: string;
  get settingsInstance(): SettingsProvider {
    return this.getProvider("settings");
  }
  constructor(private app: App) {
    super("customcss");
  }
  @IpcOn("settings.customCssWatch")
  private async _event_customCssWatch() {
    const config: {
      scssFileWatch: boolean;
      scssFile: string;
      enabled: boolean;
    } = this.settingsInstance.get("customcss");
    if (!fs.existsSync(config.scssFile) || !config) {
      return;
    }
    if (
      !config.scssFileWatch ||
      (this.scssUpdateHandler && this.scssUpdateHandler !== config.scssFile)
    ) {
      if (this.scssUpdateHandler)
        fs.unwatchFile(this.scssUpdateHandler), (this.scssUpdateHandler = null);
      return;
    }
    if (!this.scssUpdateHandler) {
      fs.watchFile(
        config.scssFile,
        { interval: 1000 },
        (curr) => curr.size > 0 && ipcMain.emit("settings.customCssUpdate")
      );
      this.scssUpdateHandler = config.scssFile;
    }
  }
  @IpcOn("settings.customCssUpdate")
  private async _event_customCssUpdate() {
    const scssPath = this.settingsInstance.get(
      "customcss.scssFile",
      path.resolve(this.app.getPath("userData"), "custom.scss")
    );
    if (!fs.existsSync(scssPath)) {
      fs.writeSync(scssPath, Buffer.from(""));
      return;
    }
    this.logger.debug(`ytd loading custom css from ${scssPath}`);
    rootWindowInjectCustomCss(
      this.views.youtubeView.webContents,
      scssPath
    ).catch(() => null);
  }
  async AfterInit() {}
}
