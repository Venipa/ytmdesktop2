import { App } from "electron";
import { BaseProvider, AfterInit } from "../utils/baseProvider";

export default class AppProvider extends BaseProvider implements AfterInit {
  constructor(private _app: App) {
    super("app");
  }
  get app() {
    return this._app;
  }
  async AfterInit() {}
}
