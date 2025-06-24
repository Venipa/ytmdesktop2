import { AfterInit, BaseProvider } from "@main/utils/baseProvider";
import { IpcContext, IpcOn } from "@main/utils/onIpcEvent";

@IpcContext
export default class VolumeRatioProvider extends BaseProvider implements AfterInit {
	constructor() {
		super("player-volume-ratio");
	}
	get settingsInstance() {
		return this.getProvider("settings");
	}
	async AfterInit() {}
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
		await this.executeCommand("enable");
		await this.forceUpdateVolume();
	}
	private async disable() {
		this.logger.debug("Disabling volume ratio");
		await this.isYtmReady();
		await this.executeCommand("disable");
		await this.forceUpdateVolume();
	}
	async forceUpdateVolume(volume?: number) {
		this.logger.debug("Force updating volume ratio", volume ?? "refreshing");
		return await this.executeCommand<number>("force_update", volume).catch(this.logger.error);
	}
}
