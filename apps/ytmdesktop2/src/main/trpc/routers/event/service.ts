import { AfterInit, BaseProvider } from "@main/core/baseProvider";
import { App } from "electron";

export default class EventProvider extends BaseProvider implements AfterInit {
	constructor(private app: App) {
		super("events");
	}
	async AfterInit() {}
}
