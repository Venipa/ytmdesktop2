import { App } from "electron";
import { BaseProvider, OnInit, OnDestroy } from "./_baseProvider";
import fs from "fs";
import { existsSync } from "fs";
import path from "path";
let _settingsStore = {};
const defaultSettings = {
  app: {
    autoupdate: true,
    autostart: true,
  },
  discord: {
    enabled: true,
    buttons: false,
  },
};
export default class SettingsProvider extends BaseProvider implements OnInit, OnDestroy {
  constructor(private app: App) {
    super("Settings Provider");
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
  private _get(obj: any, keys: string | string[]): any {
    keys = typeof keys === "string" ? keys.split(".") : keys;
    const key: string = keys.shift()!;
    if (obj.hasOwnProperty(key) && keys.length === 0) return obj[key];
    else if (!key || !obj.hasOwnProperty(key)) return undefined;
    else return this._get(obj[key], keys);
  }
  private _set(obj: any, keys: string | string[], value: any) {
    keys = typeof keys === "string" ? keys.split(".") : keys;
    const key: string = keys.shift()!;
    if (keys.length === 0) {
      obj[key!] = value;
      return;
    } else if (!_settingsStore.hasOwnProperty(key)) {
      obj[key] = {};
    }

    this._set(obj[key], keys, value);
  }
  get(keys: string | string[]) {
    return this._get(_settingsStore, keys);
  }
  set(keys: string | string[], value: any) {
    return this._set(_settingsStore, keys, value);
  }
  async saveToDrive() {
    const configFile = await this.getConfigPath();
    fs.writeFileSync(configFile, JSON.stringify(_settingsStore));
  }
  async OnDestroy() {
    await this.saveToDrive();
  }
}
