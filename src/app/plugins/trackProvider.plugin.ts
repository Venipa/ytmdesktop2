import { App } from "electron";

import { AfterInit, BaseProvider } from "@/app/utils/baseProvider";
import { IpcContext, IpcOn } from "@/app/utils/onIpcEvent";
import { serverMain } from "@/app/utils/serverEvents";
import { TrackData } from "@/app/utils/trackData";
import DiscordProvider from "./discordProvider.plugin";
type TrackState = {
  id: string;
  playing: boolean;
  progress: number;
  duration: number;
  liked: boolean;
};
const tracks: { [id: string]: TrackData } = {};
@IpcContext
export default class TrackProvider extends BaseProvider implements AfterInit {
  private _activeTrackId: string;
  private _playState: "playing" | "paused" | undefined;
  private _trackState: TrackState;
  get playState() {
    return this._playState;
  }
  get trackState() {
    return this._trackState;
  }
  setTrackState(fn: TrackState | ((d: TrackState) => void | TrackState)) {
    const isFunc = typeof fn === "function";
    const ret = isFunc ? fn(this._trackState) : fn;
    const isVoid = ret === void 0 || ret === undefined;
    this._trackState = !isVoid ? (ret as TrackState) : this._trackState;

    this.windowContext.sendToAllViews("track:play-state", {
      ...(this.trackState ?? {}),
    });
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
      serverMain.emitServer("track:change", this.trackData);
    }
  }
  @IpcOn("track:title-change", {
    debounce: 100,
  })
  private __onTitleChange(ev, trackId: string) {
    if (trackId) this.__onActiveTrack(trackId);
  }
  async currentSongIsLiked(lazy?: boolean) {
    return (
      lazy
        ? new Promise<void>((resolve) => setTimeout(() => resolve(), 500))
        : Promise.resolve()
    ).then(() =>
      this.views.youtubeView.webContents
        .executeJavaScript(
          `document.querySelector("#like-button-renderer tp-yt-paper-icon-button.like").ariaPressed`
        )
        .then((x) => x === "true")
        .catch(() => false)
    );
  }
  getTrackDuration() {
    const td = this.trackData;
    if (!this.trackData) return null;
    return ((dur) => (dur ? Number.parseInt(dur) : null))(
      td.context?.videoDetails?.durationSeconds ?? td.video?.lengthSeconds
    );
  }
  @IpcOn("track:set-active", {
    debounce: 1000
  })
  private async __onActiveTrack(trackId: string) {
    if (this._activeTrackId === trackId) return;

    this.logger.debug(`active track:`, trackId);
    this._activeTrackId = trackId;
    if (this.trackData) {
      const td = this.trackData;
      const isLiked = await this.currentSongIsLiked();
      serverMain.emitServer("track:change", td);
      this.setTrackState({
        id: trackId,
        playing: this.playing,
        duration: this.getTrackDuration(),
        liked: isLiked,
        progress: 0,
      });
    }
  }
  @IpcOn("track:play-state", {
    debounce: 100,
  })
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
    if (isPlaying && !discordProvider.isConnected && discordProvider.enabled)
      await discordProvider.enable();
    const isUIViewRequired =
      uiTimeInfo?.[1] && progressSeconds > uiTimeInfo?.[1];

    const [currentUIProgress] = isUIViewRequired
      ? uiTimeInfo
      : [progressSeconds];
    if (isUIViewRequired)
      await discordProvider.updatePlayState(isPlaying, currentUIProgress);
    else await discordProvider.updatePlayState(isPlaying, progressSeconds);
    const isLiked = await this.currentSongIsLiked();
    if (this._trackState) {
      this.setTrackState((state) => {
        state.playing = isPlaying;
        state.progress = currentUIProgress;
        state.liked = isLiked;
        state.duration = this.getTrackDuration();
      });
    } else {
      this.setTrackState({
        playing: isPlaying,
        progress: currentUIProgress,
        liked: isLiked,
        duration: this.getTrackDuration(),
        id: this._activeTrackId,
      });
    }
  }
}
