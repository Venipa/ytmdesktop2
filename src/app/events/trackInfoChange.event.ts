import ApiProvider from "../plugins/apiProvider.plugin";
import { BaseEvent, OnEventExecute } from "@/app/utils/baseEvent";
import { TrackData } from "@/app/utils/trackData";
import IPC_EVENT_NAMES from "../utils/eventNames";

export default class extends BaseEvent implements OnEventExecute {
  constructor() {
    super("track:change");
  }
  execute(track: TrackData) {
    const trackProvider = this.getProvider("track");
    trackProvider.views.toolbarView.webContents.send(
      "track:title",
      track?.video?.title
    );
    trackProvider.views.youtubeView.webContents.send(
      "track.change",
      track.video.videoId
    );
    trackProvider.windowContext.sendToAllViews(IPC_EVENT_NAMES.TRACK_CHANGE, track);
    const api = this.getProvider("api") as ApiProvider;
    api.sendMessage(this.eventName, { ...track });
  }
}
