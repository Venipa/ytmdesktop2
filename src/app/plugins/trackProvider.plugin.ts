import { App, BrowserWindow, ipcMain } from "electron";
import { debounce } from "lodash-es";
import SettingsProvider from "./settingsProvider.plugin";
import { BaseProvider, AfterInit } from "./_baseProvider";

export default class EventProvider extends BaseProvider implements AfterInit {
  get currentWindow() {
    return BrowserWindow.getAllWindows().find((x) =>
      x.webContents.getURL().match("music.youtube")
    );
  }
  constructor(private app: App) {
    super("track");
  }
  async AfterInit() {}

  async getCurrentTrack() {
    await this.currentWindow.webContents
      .executeJavaScript(
        `(() => {
      return {
        url: document.querySelector('.ytp-title-link.yt-uix-sessionlink').href,
        title: document.querySelector('.title.ytmusic-player-bar').textContent
      };
    })()`
      )
      .then((x) => {
        return {
          url: new URLSearchParams(x.url),
          title: x.title,
        };
      })
      .then((data) => {
        return {
          id: data.url.get("v"),
          title: data.title,
          url: data.url.toString(),
        };
      }).catch(this.logger.error);
  }

}
