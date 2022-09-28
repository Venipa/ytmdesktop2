import ApiProvider from "../plugins/apiProvider.plugin";
import { BaseEvent, OnEventExecute } from "@/app/utils/baseEvent";
import { TrackData } from "@/app/utils/trackData";
import IPC_EVENT_NAMES from "../utils/eventNames";
import TrackProvider from "../plugins/trackProvider.plugin";


// todo: remove nested server event calls
export default class TrackInfoChange extends BaseEvent implements OnEventExecute {
  constructor() {
    super("track:change");
  }
  execute(track: TrackData) {
    const trackProvider = this.getProvider<TrackProvider>("track");
    trackProvider.pushTrackToViews(track);
  }
}
