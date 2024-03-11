import { AfterInit, BaseProvider, BeforeStart, OnDestroy } from '@/app/utils/baseProvider';
import { IpcContext, IpcOn } from '@/app/utils/onIpcEvent';
import { TrackData } from '@/app/utils/trackData';
import { XOSMS } from '@/app/utils/xosms-types';
import { App } from 'electron';
import { MediaPlayerMediaType, MediaPlayerPlaybackStatus, MediaPlayerThumbnail, MediaPlayerThumbnailType, MediaPlayer as MediaServiceProvider } from 'xosms';

import IPC_EVENT_NAMES from '../utils/eventNames';

@IpcContext
export default class MediaControlProvider extends BaseProvider
  implements AfterInit, BeforeStart, OnDestroy {
  private _mediaProvider: MediaServiceProvider;
  private xosmsLog = this.logger.child("xosms");
  constructor(private app: App) {
    super("mediaController");
  }
  async BeforeStart(app?: App) {
    app.commandLine.appendSwitch("disable-features", "MediaSessionService");
    app.commandLine.appendSwitch("in-progress-gpu"); // gpu paint not working on some devices, todo: workaround/await fix
    app.commandLine.appendSwitch("no-sandbox"); // avoid freeze, todo: workaround/await fix
  }
  private onKeyPressed(ev, keyName, ...args) {
    this.xosmsLog.debug(["button press", keyName, ...args]);
    const trackProvider = this.getProvider("api");
    if (keyName === "pause") trackProvider.pauseTrack();
    else if (keyName === "play") trackProvider.playTrack();
    else if (keyName === "next") trackProvider.nextTrack();
    else if (keyName === "previous") trackProvider.prevTrack();
  };

  async AfterInit() {
    this._mediaProvider = new MediaServiceProvider(this.app.name, this.app.name);
    this._mediaProvider.seekEnabled = false; // to be added
    this._mediaProvider.previousButtonEnabled = true;
    this._mediaProvider.nextButtonEnabled = true;
    if (this._mediaProvider) {
      this._mediaProvider.addEventListener("buttonpressed", this.onKeyPressed.bind(this));
      this._mediaProvider.activate();
    }
    if (!this.mediaProviderEnabled())
      this.xosmsLog.warn(
        [
          "XOSMS is disabled",
          ":: Status:",
          `Provider: ${!!this
            ._mediaProvider}, Enabled: ${this.mediaProviderEnabled()}`,
        ].join(", ")
      );
  }
  get instance() {
    return this._mediaProvider;
  }
  @IpcOn(IPC_EVENT_NAMES.TRACK_PLAYSTATE)
  private __handleTrackMediaOSControl(_ev, isPlaying: boolean) {
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
      this._mediaProvider.mediaType =
        {
          ["Video"]: MediaPlayerMediaType.Music,
          ["Music"]: MediaPlayerMediaType.Music
        }[trackData.context.category] ?? MediaPlayerMediaType.Unknown;
      this._mediaProvider.playbackStatus = MediaPlayerPlaybackStatus.Playing;
      this._mediaProvider.artist = trackData.video.author;
      this._mediaProvider.albumTitle = trackData.context.pageOwnerDetails.name;
      this._mediaProvider.artist = trackData.video.author;
      if (albumThumbnail)
        this._mediaProvider.setThumbnail(await MediaPlayerThumbnail.create(MediaPlayerThumbnailType.Uri, albumThumbnail));
      this._mediaProvider.title = trackData.video.title;
      this._mediaProvider.trackId = trackData.video.videoId;
      this._mediaProvider.previousButtonEnabled = true;
      this._mediaProvider.nextButtonEnabled = true;
      this._mediaProvider.update();
    } catch (ex) {
      this.logger.error(ex); // rip media service
    }
    this.logger.debug([
      this._mediaProvider.title,
      XOSMS.MediaType[this._mediaProvider.mediaType].toString(),
      this._mediaProvider.trackId,
    ].join(", "));
  }
  OnDestroy(): void | Promise<void> {
    this._mediaProvider?.removeEventListener("buttonpressed", this.onKeyPressed);
    this._mediaProvider?.deactivate();
  }
}
