import { App } from "electron";
import { BaseProvider, AfterInit } from "../utils/baseProvider";

export default class EventProvider extends BaseProvider implements AfterInit {
  constructor(private app: App) {
    super("mediaController");
  }
  async AfterInit() {}
}
