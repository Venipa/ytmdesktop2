import { App, ipcMain } from "electron";
import { debounce } from "lodash-es";
import SettingsProvider from "./settingsProvider.plugin";
import { BaseProvider, AfterInit } from "./_baseProvider";

export default class EventProvider extends BaseProvider implements AfterInit {
  constructor(private app: App) {
    super("events");
  }
  async AfterInit() {}
}
