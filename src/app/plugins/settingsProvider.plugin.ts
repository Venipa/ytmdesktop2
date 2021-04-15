import { App, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import { BaseProvider, OnInit, OnDestroy } from "./_baseProvider";
import fs from "fs";
import { existsSync } from "fs";
import path from "path";
import { get as _get, set as _set } from "lodash-es";
import { IpcContext, IpcHandle, IpcOn } from "../utils/onIpcEvent";
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
let _settingsStore: SettingsStore = defaultSettings;
type SettingsStore = typeof defaultSettings & {[key: string]: any};

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
  get(keys: string | string[], defaultValue?: any) {
    return _get(_settingsStore, keys, defaultValue);
  }
  set(keys: string | string[], value: any) {
    return _set(_settingsStore, keys, value);
  }
  @IpcOn("settingsProvider.save", {
    debounce: 10000
  })
  async saveToDrive() {
    const configFile = await this.getConfigPath();
    fs.writeFileSync(configFile, JSON.stringify(_settingsStore));
  }
  async OnDestroy() {
    await this.saveToDrive();
  }
  @IpcHandle("settingsProvider.get")
  private _onEventGet(ev: IpcMainInvokeEvent, ...args: any[]) {
    const [key, value] = args;
    const returnValue = this.get(key);
    return returnValue === undefined || returnValue === null ? value : returnValue;
  }
  @IpcOn("settingsProvider.set")
  private _onEventSet(ev: IpcMainEvent, ...args: any[]) {
    const [key, value] = args;
    this.set(key, value);
    this.saveToDrive();
  }
  @IpcHandle("settingsProvider.update")
  private async _onEventUpdate(ev: IpcMainInvokeEvent, ...args: any[]) {
    const [key, value] = args;
    this.set(key, value);
    await this.saveToDrive();
    return value;
  }
}
