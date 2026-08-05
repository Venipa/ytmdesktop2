import { ApiWorker, createApiWorker } from "@main/api/createApiWorker";
import { AfterInit, BaseProvider } from "@main/core/baseProvider";
import { API_ROUTES } from "@shared/constants/eventNames";
import { type App } from "electron";

export default class ApiProvider extends BaseProvider implements AfterInit {
	private _thread?: ApiWorker;
	private _settingsBound = false;
	private _initPromise: Promise<void> | null = null;

	constructor(private _app: App) {
		super("api");
	}

	async AfterInit() {
		if (!this._settingsBound) {
			this._settingsBound = true;
			this.settingsProvider.onSettingChange(
				["api.enabled", "api.port"],
				(value, _prev, key) => void this.__onApiSettingChange(key, value),
				{ debounce: 500 },
			);
		}

		await this.startOrStopFromSettings();
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

	private async __onApiSettingChange(key: string, value: unknown) {
		if (key === "api.enabled") {
			if (!value) {
				await this.stopWorker();
				return;
			}
			await this.startOrStopFromSettings();
			return;
		}
		if (key === "api.port" && this.settingsProvider.instance?.api?.enabled) {
			await this.startOrStopFromSettings();
		}
	}

	private async startOrStopFromSettings() {
		if (this._initPromise) await this._initPromise;
		this._initPromise = this.runStartOrStop();
		try {
			await this._initPromise;
		} finally {
			this._initPromise = null;
		}
	}

	private async runStartOrStop() {
		await this.stopWorker();

		const config = this.settingsProvider;
		if (!config?.instance?.api?.enabled) {
			this.logger.debug("API is disabled in settings");
			return;
		}

		try {
			this._thread = await createApiWorker(this, this.windowContext.main);
			const tpid = await this._thread.initialize(this.settingsProvider.instance);
			this.logger.debug("API server initialized", {
				pid: tpid,
				port: this.settingsProvider.instance.api.port,
			});
		} catch (err) {
			this._thread = undefined;
			this.logger.error("API server failed to start", err);
		}
	}

	private async stopWorker() {
		if (!this._thread) return;
		const thread = this._thread;
		this._thread = undefined;
		await thread.destroy();
	}

	async getRoutes() {
		return Object.values(API_ROUTES).map((x) => x.replace(/^\/?api\//, ""));
	}
}
