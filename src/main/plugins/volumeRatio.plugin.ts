import { AfterInit, BaseProvider } from "@main/utils/baseProvider";
import { createSendHandler } from "@main/utils/ipc";
import { IpcContext, IpcOn } from "@main/utils/onIpcEvent";

@IpcContext
export default class VolumeRatioProvider extends BaseProvider implements AfterInit {
	constructor() {
		super("volumeRatio");
	}
	get settingsInstance() {
		return this.getProvider("settings");
	}
	async AfterInit() {
		if (this.settingsInstance.get("volumeRatio.enabled")) await this.enable();
	}
	@IpcOn("settingsProvider.change", {
		filter(ev, key: string) {
			return key === "volumeRatio.enabled";
		},
		debounce: 1000,
	})
	private async __onToggle(key: string, value: any) {
		if (value) await this.enable();
		else await this.disable();
	}
	private enable() {
		return createSendHandler<void>(this.views.youtubeView, "plugins:volume-ratio:enable")();
	}
	private disable() {
		return createSendHandler<void>(this.views.youtubeView, "plugins:volume-ratio:disable")();
	}
	forceUpdateVolume(volume?: number) {
		return createSendHandler<number>(this.views.youtubeView, "plugins:volume-ratio:cmd:force_update")(volume);
	}
}
