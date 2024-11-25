import { AfterInit, BaseProvider } from "@main/utils/baseProvider";
import { IpcContext, IpcOn } from "@main/utils/onIpcEvent";
import type { TrackData } from "@main/utils/trackData";
import { App } from "electron";
import { clamp, clone } from "lodash-es";
import { firstBy } from "thenby";

import IPC_EVENT_NAMES from "../utils/eventNames";
import ApiProvider from "./apiProvider.plugin";
import DiscordProvider from "./discordProvider.plugin";

type TrackState = {
  id: string;
  playing: boolean;
  progress: number;
  uiProgress?: number;
  duration: number;
  liked: boolean;
  disliked: boolean;
};
type TrackEntry = { id: string } & TrackData;
const trackCollection = new (class {
  private _tracks = new Array<TrackEntry>();
  constructor() {}
  private _add(id: string, value: TrackEntry) {
    if (this._tracks.length > 10) this._tracks.shift();
    value.id = id;
    this._tracks.push(value);
  }
  private _update(id: string, value: TrackEntry, idx?: number) {
    this._tracks.splice(idx ?? this._tracks.findIndex((x) => x.id === id), 1, value);
  }
  addOrUpdate(id: string, value: Omit<TrackEntry, "id">) {
    const idx = this._tracks.findIndex((x) => x.id === id);
    if (idx === -1) this._add(id, value as TrackEntry);
    else this._update(id, value as TrackEntry, idx);
    return value;
  }

  remove(id: string) {
    return this._tracks.splice(
      this._tracks.findIndex((x) => x.id === id),
      1,
    );
  }
  findById(id: string) {
    return this._tracks.find((x) => x.id === id);
  }
})();

const parseTrackDuration = (td: TrackData) => {
  return ((dur) => (dur ? Number.parseInt(dur) : null))(
    td.context?.videoDetails?.durationSeconds ?? td.video?.lengthSeconds,
  );
};
@IpcContext
export default class TrackProvider extends BaseProvider implements AfterInit {
  private _activeTrackId!: string;
  private _playState: "playing" | "paused" | undefined;
  private _trackState!: TrackState;
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
  private _trackDataCache!: TrackEntry;
  get trackData() {
    if (this._trackDataCache?.id === this._activeTrackId) return this._trackDataCache;
    return (this._trackDataCache = trackCollection.findById(this._activeTrackId)!);
  }
  async getActiveTrackByDOM() {
    return this.views.youtubeView.webContents
      .executeJavaScript(`document.querySelector("a.ytp-title-link.yt-uix-sessionlink").href`)
      .then((href) => new URLSearchParams(href.split("?")[1])?.get("v"))
      .catch(() => null);
  }

  @IpcOn("track:info-req")
  private async __onTrackInfo(ev, ytTrack: TrackData) {
    if (!ytTrack.video) return;
    const track = {
      ...ytTrack,
      meta: {
        thumbnail: (
          ytTrack?.video?.thumbnail?.thumbnails ?? ytTrack?.context?.thumbnail?.thumbnails
        )?.sort(firstBy((d) => d.height, "desc"))[0]?.url,
        isAudioExclusive: ytTrack?.video?.musicVideoType === "MUSIC_VIDEO_TYPE_ATV",
        startedAt: new Date().getTime() / 1000,
        duration: parseTrackDuration(ytTrack),
      },
    };
    trackCollection.addOrUpdate(ytTrack.video.videoId, track as TrackData);

    if (
      !this._activeTrackId ||
      track.video.videoId === this._activeTrackId ||
      (await this.getActiveTrackByDOM()) === track.video.videoId
    ) {
      const lastTrackId = this._activeTrackId;
      this._activeTrackId = track.video.videoId;
      this.pushTrackToViews(track as TrackData, lastTrackId !== track.video.videoId);
    }
  }
  @IpcOn("track:title-change", {
    debounce: 100,
  })
  private __onTitleChange(ev, trackId: string) {
    if (trackId) this.__onActiveTrack(trackId);
  }
  /**
   *
   * @param lazy 500ms timeout before throwing
   * @returns [like, dislike] tuple
   */
  async currentSongLikeState(lazy?: boolean): Promise<[boolean, boolean]> {
    return (
      lazy ? new Promise<void>((resolve) => setTimeout(() => resolve(), 500)) : Promise.resolve()
    ).then(() =>
      this.views.youtubeView.webContents
        .executeJavaScript(
          `[document.querySelector("#like-button-renderer tp-yt-paper-icon-button.like").ariaPressed, document.querySelector("#like-button-renderer tp-yt-paper-icon-button.dislike").ariaPressed]`,
        )
        .then((values: string[]) => values.map((x) => x === "true") as any)
        .catch(() => [false, false]),
    );
  }
  getTrackDuration() {
    const td = this.trackData;
    if (!td) return null;
    return parseTrackDuration(td);
  }
  @IpcOn("track:set-active", {
    debounce: 1000,
  })
  private async __onActiveTrack(trackId: string) {
    if (this._activeTrackId === trackId) return;

    this.log(`active track:`, trackId);
    this._activeTrackId = trackId;
    if (this.trackData) {
      const td = this.trackData;
      const [isLiked, isDLiked] = await this.currentSongLikeState();
      this.pushTrackToViews(td);
      this.setTrackState({
        id: trackId,
        playing: this.playing,
        duration: this.getTrackDuration()!,
        liked: isLiked,
        disliked: isDLiked,
        progress: 0,
        uiProgress: 0,
      });
    }
  }
  private trackChangeTimeout: any;
  public async pushTrackToViews(trackRef: TrackData, updateLastFm: boolean = true) {
    trackRef.meta.startedAt = new Date().getTime() / 1000;
    const track = clone(trackRef);
    this.views.toolbarView.webContents.send("track:title", track?.video?.title);
    this.views.youtubeView.webContents.send("track.change", track.video.videoId);
    this.windowContext.sendToAllViews(IPC_EVENT_NAMES.TRACK_CHANGE, track);
    const media = this.getProvider("mediaController");
    if (media) await media.handleTrackMediaOSControlChange(track);
    const api = this.getProvider("api") as ApiProvider;
    api.sendMessage("track:change", track);
    const lastfm = this.getProvider("lastfm");
    const lastfmState = lastfm.getState();
    if (updateLastFm && lastfm && lastfmState.connected && !lastfmState.processing && track.video.videoId) {
      await lastfm.handleTrackStart(track);
      if (this.trackChangeTimeout) clearTimeout(this.trackChangeTimeout);
      this.trackChangeTimeout = setTimeout(
        () => {
          lastfm.handleTrackChange(track);
          clearTimeout(this.trackChangeTimeout);
        },
        clamp(track.meta.duration * 0.65, 30, 90) * 1000,
      );
    }
  }
  @IpcOn(IPC_EVENT_NAMES.TRACK_PLAYSTATE, {
    debounce: 100,
  })
  private async __onPlayStateChange(_ev, isPlaying: boolean, progressSeconds: number = 0) {
    if (!this.trackData?.meta) return;
    this._playState = isPlaying ? "playing" : "paused";
    const discordProvider = this.getProvider("discord") as DiscordProvider;
    if (
      isPlaying &&
      !discordProvider.isConnected &&
      discordProvider.enabled &&
      discordProvider.settingsEnabled
    )
      await discordProvider.enable();
    const [progress, duration] = [progressSeconds, Number(this.trackData.meta.duration)];
    await discordProvider.updatePlayState(isPlaying, progressSeconds);

    this.getProvider("mediaController")?.instance?.setTimeline(duration, progress);
    const [isLiked, isDLiked] = await this.currentSongLikeState();
    if (this._trackState) {
      this.setTrackState((state) => {
        state.playing = isPlaying;
        state.progress = progressSeconds;
        state.uiProgress = progress;
        state.liked = isLiked;
        state.disliked = isDLiked;
        state.duration = duration;
      });
    } else {
      this.setTrackState({
        playing: isPlaying,
        progress: progressSeconds,
        uiProgress: progress,
        liked: isLiked,
        disliked: isDLiked,
        duration: duration,
        id: this._activeTrackId,
      });
    }
  }
}
