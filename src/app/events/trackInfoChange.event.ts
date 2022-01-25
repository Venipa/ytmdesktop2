import ApiProvider from "../plugins/apiProvider.plugin";
import { BaseEvent, OnEventExecute } from "@/app/utils/baseEvent";
import { TrackData } from "@/app/utils/trackData";

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
    const api = this.getProvider("api") as ApiProvider;
    api.sendMessage(this.eventName, { ...track });
  }
}
