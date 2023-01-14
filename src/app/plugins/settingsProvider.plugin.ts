import {
  AfterInit, BaseProvider, BeforeStart, OnDestroy
} from "@/app/utils/baseProvider";
import { defaultUri, defaultUrl, isDevelopment } from "@/app/utils/devUtils";
import eventNames from "@/app/utils/eventNames";
import { getViewObject } from "@/app/utils/mappedWindow";
import { IpcContext, IpcHandle, IpcOn } from "@/app/utils/onIpcEvent";
import { serverMain } from "@/app/utils/serverEvents";
import { rootWindowInjectUtils } from "@/app/utils/webContentUtils";
import { App, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import fs, { existsSync } from "fs";
import { debounce, get as _get, set as _set } from "lodash-es";
import path from "path";
import { LastFMSettings } from "ytmd";
const defaultSettings = {
  api: {
    enabled: isDevelopment ? true : false,
    port: 13091,
  },
  app: {
    beta: false,
    autoupdate: true,
    autostart: true,
    getstarted: true,
    enableDev: false,
    minimizeTrayOverride: false,
    enableStatisticsAndErrorTracing: true
  },
  player: {
    skipDisliked: false
  },
  discord: {
    enabled: true,
    buttons: false,
  },
  customcss: {
    enabled: true,
    scssFile: null,
  },
  state: {
    currentUrl: null,
  },
  lastfm: {
    enabled: false,
    auth: null,
    name: null
  } as LastFMSettings
};
let _settingsStore: SettingsStore = defaultSettings;
export type SettingsStore = typeof defaultSettings & { [key: string]: any };

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
      serverMain.emit(eventNames.SERVER_SETTINGS_CHANGE, key, value),
      this.windowContext.sendToAllViews(eventNames.SERVER_SETTINGS_CHANGE, key, value);
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
        const url = new URLSearchParams(location.split("?")[1]);
        if (url?.has("v")) serverMain.emit("track:set-active", url.get("v"));
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
            );
            serverMain.emit("settings.customCssUpdate");
            serverMain.emit("settings.customCssWatch");
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
  @IpcHandle("settingsProvider.getAll")
  private _onEventGetAll(ev: IpcMainInvokeEvent, ...args: any[]) {
    const [value] = args;
    const returnValue = _settingsStore;
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
