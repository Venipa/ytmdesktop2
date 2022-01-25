import { App } from "electron";
import { BaseProvider, AfterInit } from "@/app/utils/baseProvider";

export default class EventProvider extends BaseProvider implements AfterInit {
  constructor(private app: App) {
    super("events");
  }
  async AfterInit() {
    
  }
}
