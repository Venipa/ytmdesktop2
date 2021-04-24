import { ipcMain } from "electron";
import { BaseEvent, OnEventExecute } from "../utils/baseEvent";
import { TrackData } from "../utils/trackData";

export default class extends BaseEvent implements OnEventExecute {
  constructor() {
    super("track:change");
  }
  execute(track: TrackData) {
    this.getProvider("track").views.toolbarView.webContents.send(
      "track:title",
      track?.video?.title
    );
  }
}
