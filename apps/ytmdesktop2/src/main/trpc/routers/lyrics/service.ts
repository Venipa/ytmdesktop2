import { AfterInit, BaseProvider } from "@main/core/baseProvider";

/** Hot-toggles youtube `lyrics` plugin via settings → IPC cmds. */
export default class LyricsProvider extends BaseProvider implements AfterInit {
	constructor() {
		super("lyrics");
	}

	get settingsInstance() {
		return this.getProvider("settings");
	}

	async AfterInit() {
		this.settingsInstance.onSettingChange("lyrics.enabled", (value) => void this.__onToggle(value), {
			debounce: 300,
		});
	}

	private async __onToggle(value: unknown) {
		if (value) await this.enable();
		else await this.disable();
	}

	private async enable() {
		this.logger.debug("Enabling lyrics");
		try {
			await this.isYtmReady();
		} catch (err) {
			this.logger.warn("ytm not fully ready, enabling lyrics anyway", err);
		}
		await this.executeCommand("enable");
	}

	private async disable() {
		this.logger.debug("Disabling lyrics");
		try {
			await this.isYtmReady();
		} catch (err) {
			this.logger.warn("ytm not fully ready, disabling lyrics anyway", err);
		}
		await this.executeCommand("disable");
	}
}
