import { App, BrowserWindow } from "electron";
import { BaseProvider, AfterInit } from "../utils/baseProvider";
import { ApiWorker, createApiWorker } from "@/api/createApiWorker";
import SettingsProvider from "./settingsProvider.plugin";

export default class ApiProvider extends BaseProvider implements AfterInit {
  private _thread: ApiWorker;
  private _renderer: BrowserWindow;
  constructor(private _app: App) {
    super("api");
  }
  get app() {
    return this._app;
  }
  sendMessage(...args: any[]) {
    return this._thread?.send("socket", ...args);
  }
  async AfterInit() {
    if (this._thread) await this._thread.destroy();
    this._thread = await createApiWorker();
    const config = this.getProvider("settings") as SettingsProvider;
    const rendererId = await this._thread.invoke<number>("initialize", {
      config: { ...config!.instance },
    });
    this._renderer = BrowserWindow.getAllWindows().find(
      (x) => x.id === rendererId
    );
  }
}
