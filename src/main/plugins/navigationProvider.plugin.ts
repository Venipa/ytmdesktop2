import { AfterInit, BaseProvider } from "@main/utils/baseProvider";
import { defaultUrl } from "@main/utils/devUtils";
import { IpcContext, IpcHandle } from "@main/utils/onIpcEvent";
import { App } from "electron";

@IpcContext
export default class NavigationProvider extends BaseProvider implements AfterInit {
  constructor(private app: App) {
    super("navigation");
  }
  async AfterInit() {
    let lastNavigatioIsSameOrigin = true;
    this.views.youtubeView.webContents.on("did-navigate-in-page", (ev, url) => {
      const isHome = !!url.match(defaultUrl);
      this.logger.debug(`isHome :: ${isHome}, ${url}`);
      if (isHome !== lastNavigatioIsSameOrigin) {
        lastNavigatioIsSameOrigin = isHome;
        this.windowContext.sendToAllViews("nav.same-origin", isHome);
        if (isHome) this.handlePreloadOnWindowNav();
      }
    });
  }
  private isYTMLoaded() {
    if (this.windowContext.main.webContents.isLoading()) return null;
    return this.views.youtubeView.webContents
      .executeJavaScript(`typeof window.isYTMLoaded === "function" && !!window.isYTMLoaded()`)
      .then((x) => !!x)
      .catch(() => false);
  }
  private _isPreloading = false;
  private async handlePreloadOnWindowNav() {
    const isLoaded = await this.isYTMLoaded();
    if (isLoaded === null) return;
    if (this._isPreloading) {
      if (isLoaded) this._isPreloading = false;
      return;
    }
    if (!isLoaded) {
      this._isPreloading = true;
      this.windowContext.main.reload();
    }
  }
  @IpcHandle("action:nav.same-origin", {
    debounce: 1000,
  })
  private async __onHomeAction() {
    await this.views.youtubeView.webContents.loadURL(defaultUrl);
  }
  @IpcHandle("action:app.devTools", {
    debounce: 1000,
  })
  private async __onDevAction() {
    if (!this.views.youtubeView.webContents.isDevToolsOpened())
      this.views.youtubeView.webContents.openDevTools({ mode: "detach" });
    else this.views.youtubeView.webContents.closeDevTools();
  }
}
