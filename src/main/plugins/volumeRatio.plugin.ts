import { AfterInit, BaseProvider } from "@main/utils/baseProvider";
import { createSendHandler } from "@main/utils/ipc";
import { IpcContext, IpcOn } from "@main/utils/onIpcEvent";
import { onWindowLoad } from "@main/utils/windowUtils";
import disableScriptContent from "./resources/volume-ratio/disable-script.js?raw";
import enableScriptContent from "./resources/volume-ratio/enable-script.js?raw";

@IpcContext
export default class VolumeRatioProvider extends BaseProvider implements AfterInit {
	constructor() {
		super("volumeRatio");
	}
	get settingsInstance() {
		return this.getProvider("settings");
	}
	async AfterInit() {
		if (this.settingsInstance.get("volumeRatio.enabled")) {
			await onWindowLoad(
				this.views.youtubeView,
				async () => {
					await this.enable();
				},
				{ once: true },
			);
		}
	}
	@IpcOn("settingsProvider.change", {
		filter(key: string) {
			return key === "volumeRatio.enabled";
		},
		debounce: 1000,
	})
	private async __onToggle(key: string, value: any) {
		if (value) await this.enable();
		else await this.disable();
	}
	private async enable() {
		this.logger.debug("Enabling volume ratio");
		await this.isYtmReady();
		await this.views.youtubeView.webContents.executeJavaScript(enableScriptContent);
		await this.forceUpdateVolume();
	}
	private async disable() {
		this.logger.debug("Disabling volume ratio");
		await this.isYtmReady();
		await this.views.youtubeView.webContents.executeJavaScript(disableScriptContent);
		await this.forceUpdateVolume();
	}
	forceUpdateVolume(volume?: number) {
		this.logger.debug("Force updating volume ratio", volume ?? "refreshing");
		return createSendHandler<number>(this.views.youtubeView, "plugins:player-volume-ratio:cmd:force_update")([volume]).catch(this.logger.error);
	}
}
