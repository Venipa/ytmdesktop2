import { App, ipcMain } from "electron";
import { debounce } from "lodash-es";
import SettingsProvider from "./settingsProvider.plugin";
import { BaseProvider, AfterInit } from "./_baseProvider";

export default class EventProvider extends BaseProvider implements AfterInit {
  constructor(private app: App) {
    super("events");
  }
  async AfterInit() {
    const settingsProvider = this.queryProvider().find(
      (x) => x instanceof SettingsProvider
    ) as SettingsProvider;

    const globalLog = (...data: any[]) => console.log(...data);
    ipcMain.on("settingsProvider.get", (ev, ...args) => {
      globalLog("settingsProvider.get", JSON.stringify(args));
      const [key, value] = args;
      ev.returnValue = settingsProvider.get(key) || value;
    });
    ipcMain.on(
      "settingsProvider.set",
      debounce((ev, ...args) => {
        globalLog("settingsProvider.set", JSON.stringify(args));
        const [key, value] = args;
        settingsProvider.set(key, value);
      }, 1000)
    );
    ipcMain.on(
      "settingsProvider.save",
      debounce(() => {
        settingsProvider.saveToDrive();
      }, 1000)
    );
  }
}
