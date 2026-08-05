import { type AuthClientRecord, appAuth, type PendingAuthRequest, readAuthClients, writeAuthClients } from "@main/auth";
import { AfterInit, BaseProvider } from "@main/core/baseProvider";
import { type App } from "electron";
import { Subject } from "rxjs";

/**
 * Global auth provider — owns pairing UX + encrypted client persistence.
 * API / Stream Deck / Remote gate on `appAuth.isValidToken`.
 */
export default class AuthProvider extends BaseProvider implements AfterInit {
	private _bound = false;

	readonly pendingAuth$ = new Subject<PendingAuthRequest | null>();
	readonly clients$ = new Subject<AuthClientRecord[]>();

	constructor(private _app: App) {
		super("auth");
	}

	async AfterInit() {
		if (this._bound) return;
		this._bound = true;

		appAuth.loadClients(readAuthClients());

		appAuth.on("pending", (pending: PendingAuthRequest) => {
			this.pendingAuth$.next(pending);
			void (async () => {
				const win = await this.getProvider("app").openSettingsWindow();
				if (win && !win.isDestroyed()) {
					const { loadUrlOfWindow } = await import("@main/windows/webContentUtils");
					await loadUrlOfWindow(win, "/api-integrations/authentication");
				}
			})();
		});
		appAuth.on("resolved", () => {
			this.pendingAuth$.next(appAuth.listPending()[0] ?? null);
		});
		appAuth.on("clients", (next: AuthClientRecord[]) => {
			writeAuthClients(next);
			this.clients$.next(next);
		});
	}

	get app() {
		return this._app;
	}

	getPendingAuth(): PendingAuthRequest[] {
		return appAuth.listPending();
	}

	getClients(): AuthClientRecord[] {
		return appAuth.listClients();
	}

	approveAuth(id: string): AuthClientRecord | null {
		return appAuth.approve(id);
	}

	denyAuth(id: string): boolean {
		return appAuth.deny(id);
	}

	revokeClient(appId: string): boolean {
		return appAuth.revoke(appId);
	}

	revokeAllClients() {
		appAuth.revokeAll();
	}

	createManualClient(input: { appId: string; appName: string; appVersion?: string }): AuthClientRecord {
		return appAuth.createManual(input);
	}

	getClientToken(appId: string): string | null {
		return appAuth.getClientToken(appId);
	}
}
