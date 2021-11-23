import { App } from "electron";
import { BaseProvider, AfterInit } from "../utils/baseProvider";
import { defaultUrl } from "../utils/devUtils";
import { IpcContext, IpcOn } from "../utils/onIpcEvent";

@IpcContext
export default class EventProvider extends BaseProvider implements AfterInit {
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
      }
    });
  }

  @IpcOn("action:nav.same-origin", {
    debounce: 1000,
  })
  private async __onHomeAction() {
    await this.views.youtubeView.webContents.loadURL(defaultUrl);
  }
}
