import { ApiWorker, createApiWorker } from "@main/api/createApiWorker";
import { AfterInit, BaseProvider } from "@main/core/baseProvider";
import { API_ROUTES } from "@shared/constants/eventNames";
import { type App } from "electron";

export default class ApiProvider extends BaseProvider implements AfterInit {
	private _thread?: ApiWorker;
	private _settingsBound = false;

	constructor(private _app: App) {
		super("api");
	}

	async AfterInit() {
		if (!this._settingsBound) {
			this._settingsBound = true;
			this.settingsProvider.onSettingChange("api.enabled", (value) => void this.__onApiEnabled("api.enabled", value as boolean), {
				debounce: 1000,
			});
		}

		if (this._thread) {
			await this._thread.destroy();
			this._thread = undefined;
		}

		const config = this.settingsProvider;
		if (!config?.instance?.api?.enabled) {
			this.logger.debug("API is disabled in settings");
			return;
		}

		this._thread = await createApiWorker(this, this.windowContext.main);
		const tpid = await this._thread.initialize(this.settingsProvider.instance);
		this.logger.debug("API worker initialized with pid:", tpid);
	}

	get app() {
		return this._app;
	}

	get isInitialized() {
		return !!this._thread;
	}

	sendMessage(...args: any[]) {
		return this._thread?.invoke("socket", ...args);
	}

	private get settingsProvider() {
		return this.getProvider("settings");
	}

	private async __onApiEnabled(key: string, value: boolean) {
		if (!value) {
			if (this._thread) {
				await this._thread.destroy();
				this._thread = undefined;
			}
		} else {
			await this.AfterInit();
		}
	}

	async getRoutes() {
		return Object.values(API_ROUTES).map((x) => x.replace(/^\/?api\//, ""));
	}
}
