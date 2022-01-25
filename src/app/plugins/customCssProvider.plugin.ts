import { App, ipcMain } from "electron";
import { IpcContext, IpcOn } from "@/app/utils/onIpcEvent";
import fs from "fs";
import path from "path";
import SettingsProvider from "./settingsProvider.plugin";
import { BaseProvider, AfterInit } from "@/app/utils/baseProvider";
import { rootWindowInjectCustomCss } from "@/app/utils/webContentUtils";
// @ts-ignore
import customDefaultCss from "!raw-loader!../../assets/default-custom.scss";
@IpcContext
export default class EventProvider extends BaseProvider implements AfterInit {
  private scssUpdateHandler: string;
  get settingsInstance(): SettingsProvider {
    return this.getProvider("settings");
  }
  constructor(private app: App) {
    super("customcss");
  }
  private getScssPath() {
    return this.settingsInstance.get(
      "customcss.scssFile",
      path.resolve(this.app.getPath("documents"), "ytmdesktop", "custom.scss")
    );
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
    const scssPath = this.getScssPath();
    if (!fs.existsSync(scssPath)) {
      fs.writeFileSync(scssPath, customDefaultCss);
      return;
    }
    this.logger.debug(`ytd loading custom css from ${scssPath}`);
    rootWindowInjectCustomCss(
      this.views.youtubeView.webContents,
      scssPath
    ).catch(() => null);
  }
  async AfterInit() {
    const scssPath = this.getScssPath(),
      scssParent = path.resolve(scssPath, "..");
    if (!fs.existsSync(scssPath)) {
      if (!fs.existsSync(scssParent)) {
        fs.mkdirSync(scssParent, { recursive: true });
      }
      fs.writeFileSync(scssPath, customDefaultCss);
      this.settingsInstance.set("customcss.enabled", true);
      this.settingsInstance.set("customcss.scssFile", scssPath);
    }
  }
}
