import { App, ipcMain, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import {
  BaseProvider,
  OnInit,
  OnDestroy,
  BeforeStart,
  AfterInit,
} from "./_baseProvider";
import fs from "fs";
import { existsSync } from "fs";
import path from "path";
import { debounce, get as _get, set as _set } from "lodash-es";
import { IpcContext, IpcHandle, IpcOn } from "../utils/onIpcEvent";
import {
  rootWindowInjectCustomCss,
  rootWindowInjectUtils,
} from "../utils/webContentUtils";
import { getViewObject } from "../utils/mappedWindow";
import { defaultUri, defaultUrl } from "../utils/devUtils";
const defaultSettings = {
  app: {
    autoupdate: true,
    autostart: true,
    getstarted: true,
  },
  discord: {
    enabled: true,
    buttons: false,
  },
  customcss: {
    enabled: false,
    scssFile: null,
  },
  state: {
    currentUrl: null,
  },
};
let _settingsStore: SettingsStore = defaultSettings;
type SettingsStore = typeof defaultSettings & { [key: string]: any };

@IpcContext
export default class SettingsProvider extends BaseProvider
  implements OnDestroy, BeforeStart, AfterInit {
  constructor(private app: App) {
    super("settings");
  }
  private async getConfigPath() {
    return await path.resolve(
      this.app.getPath("userData"),
      "app-settings.json"
    );
  }
  async BeforeStart() {
    const configFile = await this.getConfigPath();
    this.logger.debug(configFile);
    if (existsSync(configFile)) {
      _settingsStore = {
        ...defaultSettings,
        ...JSON.parse(fs.readFileSync(configFile).toString()),
      };
    } else {
      _settingsStore = { ...defaultSettings };
    }
    await this.saveToDrive();
  }
  get instance() {
    return _settingsStore;
  }
  get(key: string, defaultValue?: any) {
    return _get(_settingsStore, key, defaultValue);
  }
  set(key: string, value: any) {
    _set(_settingsStore, key, value);
    try {
      ipcMain.emit("settingsProvider.change", key, value);
    } catch (ex) {
      this.logger.error(ex);
    }
    return this;
  }
  @IpcOn("settingsProvider.save", {
    debounce: 10000,
  })
  async saveToDrive() {
    const configFile = await this.getConfigPath();
    fs.writeFileSync(configFile, JSON.stringify(_settingsStore));
  }
  async OnDestroy() {
    await this.saveToDrive();
  }
  AfterInit() {
    this.views.youtubeView.webContents.on(
      "did-navigate-in-page",
      (ev, location) => {
        this.logger.debug(`navigate-in-page :: ${location}`);
      }
    );
    let previousHostname: string = defaultUrl;
    this.views.youtubeView.webContents.on(
      "did-navigate",
      debounce((ev: Electron.Event, location: string) => {
        this.logger.debug("navigate", location);
        const url = new URL(location);
        if (url) {
          if (
            url.hostname === defaultUri.hostname &&
            previousHostname !== url.hostname
          ) {
            rootWindowInjectUtils(
              this.views.youtubeView.webContents,
              getViewObject(this.views)
            ),
              ipcMain.emit("settings.customCssUpdate");
            ipcMain.emit("settings.customCssWatch");
          }
          previousHostname = url.hostname;
          if (url.hostname !== defaultUri.hostname) {
            this.views.toolbarView.webContents.send("track:title", null); // disable title bar track title
          }
        }
      }, 500)
    );
  }
  @IpcHandle("settingsProvider.get")
  private _onEventGet(ev: IpcMainInvokeEvent, ...args: any[]) {
    const [key, value] = args;
    const returnValue = this.get(key);
    return returnValue === undefined || returnValue === null
      ? value
      : returnValue;
  }
  @IpcOn("settingsProvider.set")
  private _onEventSet(ev: IpcMainEvent, ...args: any[]) {
    const [key, value] = args;
    this.set(key, value);
    this.logger.debug(key, value);
    this.saveToDrive();
  }
  @IpcHandle("settingsProvider.update")
  private async _onEventUpdate(ev: IpcMainInvokeEvent, ...args: any[]) {
    const [key, value] = args;
    this.logger.debug(key, value);
    this.set(key, value);
    await this.saveToDrive();
    return value;
  }
}
