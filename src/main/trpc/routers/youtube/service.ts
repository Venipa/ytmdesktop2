import { AfterInit, BaseProvider, BeforeStart } from "@main/core/baseProvider";
import { IpcContext } from "@main/ipc/onIpcEvent";
import { App } from "electron";

@IpcContext
export default class YoutubeControlProvider extends BaseProvider implements AfterInit, BeforeStart {
	constructor(private app: App) {
		super("youtube");
	}
	async BeforeStart() {}
	async AfterInit() {}
}
