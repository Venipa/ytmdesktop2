import { AfterInit, BaseProvider, BeforeStart } from "@main/core/baseProvider";
import { App } from "electron";

export default class YoutubeControlProvider extends BaseProvider implements AfterInit, BeforeStart {
	constructor(private app: App) {
		super("youtube");
	}
	async BeforeStart() {}
	async AfterInit() {}
}
