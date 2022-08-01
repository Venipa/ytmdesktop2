import { App } from "electron";

import { AfterInit, BaseProvider } from "@/app/utils/baseProvider";
import { IpcContext, IpcOn } from "@/app/utils/onIpcEvent";
import { serverMain } from "@/app/utils/serverEvents";
import { TrackData } from "@/app/utils/trackData";
import DiscordProvider from "./discordProvider.plugin";

const tracks: { [id: string]: TrackData } = {};
@IpcContext
export default class TrackProvider extends BaseProvider implements AfterInit {
  private _activeTrackId: string;
  private _playState: "playing" | "paused" | undefined;
  get playState() {
    return this._playState;
  }
  get playing() {
    return this.playState === "playing";
  }
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
      serverMain.emit("track:change", this.trackData);
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
    if (this.trackData) {
      serverMain.emit("track:change", this.trackData);
    }
  }
  @IpcOn("track:play-state")
  private async __onPlayStateChange(
    _ev,
    isPlaying: boolean,
    progressSeconds: number = 0,
    uiTimeInfo: [number, number] = null
  ) {
    this.logger.debug(
      [
        "play state change",
        isPlaying ? "playing" : "paused",
        ", progress: ",
        progressSeconds,
        ", ui progress: ",
        ...(uiTimeInfo?.length > 0 ? uiTimeInfo : ["-"]),
      ].join(" ")
    );
    this._playState = isPlaying ? "playing" : "paused";
    const discordProvider = this.getProvider("discord") as DiscordProvider;
    if (isPlaying && !discordProvider.isConnected && discordProvider.enabled) await discordProvider.enable();
    if (uiTimeInfo?.[1] && progressSeconds > uiTimeInfo?.[1]) {
      const [currentUIProgress] = uiTimeInfo;
      return await discordProvider.updatePlayState(isPlaying, currentUIProgress);
    }
    return await discordProvider.updatePlayState(isPlaying, progressSeconds);
  }
}
