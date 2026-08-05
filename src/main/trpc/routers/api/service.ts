import { ApiWorker, createApiWorker } from "@main/api/createApiWorker";
import { AfterInit, BaseProvider } from "@main/core/baseProvider";
import { API_ROUTES } from "@shared/constants/eventNames";
import { type App } from "electron";

export default class ApiProvider extends BaseProvider implements AfterInit {
	private _thread?: ApiWorker;
	private _settingsBound = false;
	/** Serialize start/stop so disable cannot lose a race to an in-flight start. */
	private _lifecycleChain: Promise<void> = Promise.resolve();

	constructor(private _app: App) {
		super("api");
	}

	async AfterInit() {
		if (!this._settingsBound) {
			this._settingsBound = true;
			this.settingsProvider.onSettingChange(
				["api.enabled", "api.port"],
				(_value, _prev, key) => void this.__onApiSettingChange(key),
				{ debounce: 200 },
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

	private isApiEnabled(): boolean {
		return this.settingsProvider?.instance?.api?.enabled === true;
	}

	private async __onApiSettingChange(key: string) {
		if (key === "api.enabled" || key === "api.port") {
			await this.startOrStopFromSettings();
		}
	}

	private startOrStopFromSettings(): Promise<void> {
		this._lifecycleChain = this._lifecycleChain
			.catch(() => undefined)
			.then(() => this.runStartOrStop());
		return this._lifecycleChain;
	}

	private async runStartOrStop() {
		await this.stopWorker();

		if (!this.isApiEnabled()) {
			this.logger.debug("API is disabled in settings");
			return;
		}

		const port = this.settingsProvider.instance.api.port;
		try {
			const worker = await createApiWorker(this, this.windowContext.main);
			// Disabled while createApiWorker awaited
			if (!this.isApiEnabled()) {
				await worker.destroy();
				this.logger.debug("API disabled before listen — aborted start");
				return;
			}

			await worker.initialize(this.settingsProvider.instance);

			// Disabled while listen awaited
			if (!this.isApiEnabled()) {
				await worker.destroy();
				this.logger.debug("API disabled during listen — tore down");
				return;
			}

			this._thread = worker;
			this.logger.debug("API server initialized", { port });
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
		this.logger.debug("API server stopped");
	}

	async getRoutes() {
		return Object.values(API_ROUTES).map((x) => x.replace(/^\/?api\//, ""));
	}
}
