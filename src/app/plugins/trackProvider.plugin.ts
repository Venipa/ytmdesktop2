import { App, BrowserWindow, ipcMain } from "electron";
import { debounce } from "lodash-es";
import SettingsProvider from "./settingsProvider.plugin";
import { BaseProvider, AfterInit } from "../utils/baseProvider";

export default class TrackProvider extends BaseProvider implements AfterInit {
  get currentWindow() {
    return BrowserWindow.getAllWindows().find((x) =>
      x.webContents.getURL().match("music.youtube")
    );
  }
  constructor(private app: App) {
    super("track");
  }
  async AfterInit() {}

  async getCurrentTrack(): Promise<{ url: string; title: string; id: string }> {
    return await this.views.youtubeView.webContents
      .executeJavaScript(
        `(() => {
         const title = document.querySelector(".title.ytmusic-player-bar") || document.querySelector(".song-title[title]");
         const url = document.querySelector(".ytp-title-link.yt-uix-sessionlink");
      return {
        url: url && url.href.match(/^http/) ? url.href : null,
        title: title ? title.textContent : null
      };
    })()`
      )
      .then(({ url, title }) => {
        if (!url || !title) {
          throw new Error("failed to parse track data");
        }
        return {
          url: new URLSearchParams(url),
          title: title,
        };
      })
      .then(({ title, url }) => {
        return {
          id: url.get("v"),
          title: title,
          url: decodeURIComponent(url.toString()),
        };
      })
      .catch((err) => {
        this.logger.error(err);
        return null;
      });
  }
}
