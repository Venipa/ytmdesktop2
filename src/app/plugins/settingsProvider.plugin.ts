import { App, IpcMainEvent } from "electron";
import { BaseProvider, OnInit, OnDestroy } from "./_baseProvider";
import fs from "fs";
import { existsSync } from "fs";
import path from "path";
import { get as _get, set as _set } from "lodash-es";
import { IpcContext, IpcOn } from "../utils/onIpcEvent";
let _settingsStore = {};
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
    scssFile: null
  }
};

@IpcContext
export default class SettingsProvider extends BaseProvider
  implements OnInit, OnDestroy {
  constructor(private app: App) {
    super("settings");
  }
  private async getConfigPath() {
    return await path.resolve(
      this.app.getPath("userData"),
      "app-settings.json"
    );
  }
  async OnInit() {
    const configFile = await this.getConfigPath();
    console.log(configFile);
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
  get(keys: string | string[], defaultValue?: any) {
    return _get(_settingsStore, keys, defaultValue);
  }
  set(keys: string | string[], value: any) {
    return _set(_settingsStore, keys, value);
  }
  @IpcOn("settingsProvider.save", 10000)
  async saveToDrive() {
    const configFile = await this.getConfigPath();
    fs.writeFileSync(configFile, JSON.stringify(_settingsStore));
  }
  async OnDestroy() {
    await this.saveToDrive();
  }
  @IpcOn("settingsProvider.get")
  private _onEventGet(ev: IpcMainEvent, ...args: any[]) {
    const [key, value] = args;
    const returnValue = this.get(key);
    ev.returnValue =
      returnValue === undefined || returnValue === null ? value : returnValue;
  }
  @IpcOn("settingsProvider.set")
  private _onEventSet(ev: IpcMainEvent, ...args: any[]) {
    const [key, value] = args;
    this.set(key, value);
    this.saveToDrive();
  }
}
