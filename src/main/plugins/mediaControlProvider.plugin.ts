import { AfterInit, BaseProvider, BeforeStart, OnDestroy } from "@main/utils/baseProvider";
import { IpcContext, IpcOn } from "@main/utils/onIpcEvent";
import { TrackData } from "@main/utils/trackData";
import { app, type App } from "electron";
import {
  MediaPlayerMediaType,
  MediaPlayerPlaybackStatus,
  MediaPlayerThumbnail,
  MediaPlayerThumbnailType,
  MediaPlayer as MediaServiceProvider,
} from "xosms";

import { clamp } from "lodash-es";
import IPC_EVENT_NAMES from "../utils/eventNames";

@IpcContext
export default class MediaControlProvider
  extends BaseProvider
  implements AfterInit, BeforeStart, OnDestroy
{
  private _mediaProvider!: MediaServiceProvider;
  private xosmsLog = this.logger.child("xosms");
  constructor(private app: App) {
    super("mediaController");
  }
  async BeforeStart() {
    app.commandLine.appendSwitch("disable-features", "MediaSessionService");
    app.commandLine.appendSwitch("in-progress-gpu"); // gpu paint not working on some devices, todo: workaround/await fix
    // app.commandLine.appendSwitch("no-sandbox"); // avoid freeze, todo: workaround/await fix
  }
  private onKeyPressed(ev, keyName, ...args) {
    this.xosmsLog.debug(["button press", keyName, ...args]);
    const trackProvider = this.getProvider("api");
    if (keyName === "pause") trackProvider.pauseTrack();
    else if (keyName === "play") trackProvider.playTrack();
    else if (keyName === "next") trackProvider.nextTrack();
    else if (keyName === "previous") trackProvider.prevTrack();
  }
  private onPosChange(ev, pos) {
    this.logger.debug("onPosChange", pos);
    return this.api.seekTrack(null, {
      type: "seek", // seeking to pos
      time: pos * 1000,
    });
  }
  private onPosSeek(ev, seek) {
    this.logger.debug("onPosSeek", seek);
    return this.api.seekTrack(null, {
      time: seek * 1000, // adjust player pos to seeked value
    });
  }

  async AfterInit() {
    this._mediaProvider = new MediaServiceProvider(this.app.name, this.app.name);
    this._mediaProvider.seekEnabled = true; // to be added
    this._mediaProvider.previousButtonEnabled = true;
    this._mediaProvider.nextButtonEnabled = true;
    if (this._mediaProvider) {
      this._mediaProvider.addEventListener("buttonpressed", this.onKeyPressed.bind(this));
      this._mediaProvider.addEventListener("positionchanged", this.onPosChange.bind(this));
      this._mediaProvider.addEventListener("positionseeked", this.onPosSeek.bind(this));
      this._mediaProvider.activate();
    }
    if (!this.mediaProviderEnabled())
      this.xosmsLog.warn(
        "XOSMS is disabled",
        ":: Status:",
        `Provider: ${!!this._mediaProvider}, Enabled: ${this.mediaProviderEnabled()}`,
      );
  }
  get instance() {
    return this._mediaProvider;
  }
  get trackData() {
    return this.getProvider("track").trackData;
  }
  get api() {
    return this.getProvider("api");
  }
  @IpcOn(IPC_EVENT_NAMES.TRACK_PLAYSTATE)
  private __handleTrackMediaOSControl(_ev, isPlaying: boolean, progressSeconds: number = 0) {
    if (!this.mediaProviderEnabled()) return;

    const { trackData } = this.getProvider("track");
    if (!trackData) {
      this._mediaProvider.playbackStatus = MediaPlayerPlaybackStatus.Stopped;
      this._mediaProvider.playButtonEnabled = true;
      this._mediaProvider.pauseButtonEnabled = false;
    } else {
      this._mediaProvider.playbackStatus = isPlaying
        ? MediaPlayerPlaybackStatus.Playing
        : MediaPlayerPlaybackStatus.Paused;

      this._mediaProvider.playButtonEnabled = !isPlaying;
      this._mediaProvider.pauseButtonEnabled = isPlaying;
      const [progress, duration] = [progressSeconds, Number(this.trackData!.meta.duration)];
      this._mediaProvider.setTimeline(duration, clamp(progress, 0, duration));
    }
    this._mediaProvider.update();
  }
  private mediaProviderEnabled() {
    return !!this._mediaProvider;
  }
  async handleTrackMediaOSControlChange(trackData: TrackData) {
    const isEnabled = this.mediaProviderEnabled();
    if (!isEnabled || !trackData?.video) return;
    const albumThumbnail = trackData.meta.thumbnail;
    try {
      this._mediaProvider.mediaType = MediaPlayerMediaType.Music; // always music for now.
      this._mediaProvider.playbackStatus = MediaPlayerPlaybackStatus.Playing;
      this._mediaProvider.artist = trackData.video.author;
      this._mediaProvider.albumTitle = trackData.context.pageOwnerDetails.name;
      this._mediaProvider.artist = trackData.video.author;
      if (albumThumbnail)
        this._mediaProvider.setThumbnail(
          await MediaPlayerThumbnail.create(MediaPlayerThumbnailType.Uri, albumThumbnail),
        );
      this._mediaProvider.title = trackData.video.title;
      this._mediaProvider.trackId = trackData.video.videoId;
      this._mediaProvider.previousButtonEnabled = true;
      this._mediaProvider.nextButtonEnabled = true;
      this._mediaProvider.update();
    } catch (ex) {
      this.logger.error(ex); // rip media service
    }
    this.logger.debug(
      this._mediaProvider.title,
      this._mediaProvider.mediaType,
      this._mediaProvider.trackId,
    );
  }
  OnDestroy(): void | Promise<void> {
    this._mediaProvider?.removeEventListener("buttonpressed", this.onKeyPressed);
    this._mediaProvider?.deactivate();
  }
}
