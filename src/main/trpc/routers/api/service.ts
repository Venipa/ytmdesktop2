import { type ApiClientRecord, apiAuth, type PendingAuthRequest } from "@main/api/auth";
import { ApiWorker, createApiWorker } from "@main/api/createApiWorker";
import { AfterInit, BaseProvider } from "@main/core/baseProvider";
import { API_ROUTES } from "@shared/constants/eventNames";
import { type App } from "electron";
import { Subject } from "rxjs";

export default class ApiProvider extends BaseProvider implements AfterInit {
	private _thread?: ApiWorker;
	private _settingsBound = false;
	private _authBound = false;
	/** Serialize start/stop so disable cannot lose a race to an in-flight start. */
	private _lifecycleChain: Promise<void> = Promise.resolve();

	readonly pendingAuth$ = new Subject<PendingAuthRequest | null>();
	readonly clients$ = new Subject<ApiClientRecord[]>();

	constructor(private _app: App) {
		super("api");
	}

	async AfterInit() {
		if (!this._settingsBound) {
			this._settingsBound = true;
			this.settingsProvider.onSettingChange(
				["api.enabled", "api.port", "api.authRequired"],
				(_value, _prev, key) => void this.__onApiSettingChange(key),
				{ debounce: 200 },
			);
		}

		if (!this._authBound) {
			this._authBound = true;
			apiAuth.loadClients(this.settingsProvider.instance.api?.clients);
			apiAuth.on("pending", (pending: PendingAuthRequest) => {
				this.pendingAuth$.next(pending);
				void (async () => {
					const win = await this.getProvider("app").openSettingsWindow();
					if (win && !win.isDestroyed()) {
						const { loadUrlOfWindow } = await import("@main/windows/webContentUtils");
						await loadUrlOfWindow(win, "/streamdeck");
					}
				})();
			});
			apiAuth.on("resolved", () => {
				this.pendingAuth$.next(apiAuth.listPending()[0] ?? null);
			});
			apiAuth.on("clients", (clients: ApiClientRecord[]) => {
				this.settingsProvider.set("api.clients", clients);
				this.clients$.next(clients);
			});
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

	getPendingAuth(): PendingAuthRequest[] {
		return apiAuth.listPending();
	}

	getClients(): ApiClientRecord[] {
		return apiAuth.listClients();
	}

	approveAuth(id: string): ApiClientRecord | null {
		return apiAuth.approve(id);
	}

	denyAuth(id: string): boolean {
		return apiAuth.deny(id);
	}

	revokeClient(appId: string): boolean {
		return apiAuth.revoke(appId);
	}

	revokeAllClients() {
		apiAuth.revokeAll();
	}

	private get settingsProvider() {
		return this.getProvider("settings");
	}

	private isApiEnabled(): boolean {
		return this.settingsProvider?.instance?.api?.enabled === true;
	}

	private async __onApiSettingChange(key: string) {
		if (key === "api.enabled" || key === "api.port" || key === "api.authRequired") {
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
			if (!this.isApiEnabled()) {
				await worker.destroy();
				this.logger.debug("API disabled before listen — aborted start");
				return;
			}

			await worker.initialize(this.settingsProvider.instance);

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
