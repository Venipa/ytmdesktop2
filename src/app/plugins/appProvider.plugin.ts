import { App } from "electron";
import { BaseProvider, AfterInit } from "../utils/baseProvider";
import { IpcContext, IpcOn } from "../utils/onIpcEvent";
import { setSentryEnabled } from "@/app/utils/sentry";

@IpcContext
export default class AppProvider extends BaseProvider implements AfterInit {
  constructor(private _app: App) {
    super("app");
  }
  get app() {
    return this._app;
  }
  async AfterInit() {}
  @IpcOn("settingsProvider.change", {
    filter: (key: string) => key === "app.enableStatisticsAndErrorTracing",
    debounce: 10000,
  })
  private __toggleSentryLogging(_key: string, value: boolean) {
    if (value) {
      setSentryEnabled(true);
    } else {
      setSentryEnabled(false);
    }
  }
}
