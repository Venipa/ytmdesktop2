import { App, ipcMain } from 'electron';

import { AfterInit, BaseProvider } from '../utils/baseProvider';
import { IpcContext, IpcOn } from '../utils/onIpcEvent';
import { TrackData } from '../utils/trackData';
import DiscordProvider from './discordProvider.plugin';

const tracks: { [id: string]: TrackData } = {};
@IpcContext
export default class TrackProvider extends BaseProvider implements AfterInit {
  private _activeTrackId: string;
  constructor(private app: App) {
    super("track");
  }
  async AfterInit() {}
  get trackData() {
    return tracks[this._activeTrackId];
  }
  async getActiveTrackByDOM() {
    return this.views.youtubeView.webContents
      .executeJavaScript(
        `document.querySelector("a.ytp-title-link.yt-uix-sessionlink").href`
      )
      .then((href) => new URLSearchParams(href.split("?")[1])?.get("v"))
      .catch(() => null);
  }

  @IpcOn("track:info-req")
  private async __onTrackInfo(ev, track: TrackData) {
    if (!track.video) return;
    tracks[track.video.videoId] = track;

    if (
      track.video.videoId === this._activeTrackId ||
      (await this.getActiveTrackByDOM()) === track.video.videoId
    ) {
      this._activeTrackId = track.video.videoId;
      ipcMain.emit("track:change", this.trackData);
    }
  }
  @IpcOn("track:title-change", {
    debounce: 100,
  })
  private __onTitleChange(ev, trackId: string) {
    if (trackId) this.__onActiveTrack(trackId);
  }
  @IpcOn("track:set-active")
  private __onActiveTrack(trackId: string) {
    if (this._activeTrackId === trackId) return;

    this.logger.debug(`active track:`, trackId);
    this._activeTrackId = trackId;
    if (this.trackData) ipcMain.emit("track:change", this.trackData);
  }
  @IpcOn("track:play-state")
  private __onPlayStateChange(_ev, val: boolean, progressSeconds: number = 0) {
    this.logger.debug(
      [
        "play state change",
        val ? "playing" : "paused",
        ", progress: ",
        progressSeconds,
      ].join(" ")
    );
    const discordProvider = this.getProvider("discordRPC") as DiscordProvider;
    discordProvider.updatePlayState(val, progressSeconds);
  }
}
