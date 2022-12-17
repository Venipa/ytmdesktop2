import { App } from "electron";
import { IpcContext, IpcOn } from "@/app/utils/onIpcEvent";
import fs from "fs";
import path from "path";
import SettingsProvider from "./settingsProvider.plugin";
import { BaseProvider, AfterInit } from "@/app/utils/baseProvider";
import {
  rootWindowClearCustomCss,
  rootWindowInjectCustomCss,
} from "@/app/utils/webContentUtils";
// @ts-ignore
import customDefaultCss from "!raw-loader!../../assets/default-custom.scss";
import { serverMain } from "@/app/utils/serverEvents";
@IpcContext
export default class CustomCSSProvider extends BaseProvider implements AfterInit {
  private scssUpdateHandler: string;
  get settingsInstance(): SettingsProvider {
    return this.getProvider("settings");
  }
  constructor(private app: App) {
    super("customcss");
  }
  private getScssPath() {
    return (
      this.settingsInstance.get("customcss.scssFile") ??
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
    }
    if (!this.scssUpdateHandler && config.scssFileWatch) {
      fs.watchFile(
        config.scssFile,
        { interval: 1000 },
        (curr) => curr.size > 0 && serverMain.emit("settings.customCssUpdate")
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
  @IpcOn("settingsProvider.change", {
    filter: (key: string) => key === "customcss.enabled",
    debounce: 1000,
  })
  private async _event_toggleCss(_key: string, value: boolean) {
    if (!value) rootWindowClearCustomCss(this.views.youtubeView.webContents);
    else {
      const scssFile = this.getScssPath();
      if (scssFile) await this._initializeSCSS();
      rootWindowInjectCustomCss(this.views.youtubeView.webContents, scssFile);
    }
  }
  async AfterInit() {
    this._initializeSCSS().then(() => {
      if (this.settingsInstance.instance?.customcss?.enabled)
        this._event_toggleCss(null, true);
    });
  }
  private async _initializeSCSS() {
    const scssPath = this.getScssPath(),
      scssParent = path.resolve(scssPath, "..");
    if (!fs.existsSync(scssPath)) {
      if (!fs.existsSync(scssParent)) {
        fs.mkdirSync(scssParent, { recursive: true });
      }
      fs.writeFileSync(scssPath, customDefaultCss);
      this.settingsInstance
        .set("customcss.enabled", true)
        .set("customcss.scssFile", scssPath);
      this.logger.debug("has scss data " + !!customDefaultCss);
      if (this.settingsInstance.get("customcss.scssFileWatch"))
        serverMain.emit("settings.customCssWatch");
      return true;
    }
    return false;
  }
}
