import { App } from "electron";
import { BaseProvider, OnInit, OnDestroy } from "./_baseProvider";
import fs from "fs";
import { existsSync } from "fs";
import path from "path";
import { get as _get, set as _set } from "lodash-es";
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
  async saveToDrive() {
    const configFile = await this.getConfigPath();
    fs.writeFileSync(configFile, JSON.stringify(_settingsStore));
  }
  async OnDestroy() {
    await this.saveToDrive();
  }
}
