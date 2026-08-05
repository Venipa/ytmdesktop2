import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import { createId } from "@paralleldrive/cuid2";
import { createAuthToken, parseAuthToken } from "./crypto";

const AUTH_CODE_TTL_MS = 60_000;
const AUTH_REQUEST_TIMEOUT_MS = 30_000;

/** Paired client — `token` is encryption.js blob with client state. */
export interface AuthClientRecord {
	appId: string;
	appName: string;
	appVersion: string;
	createdAt: number;
	token: string;
}

export interface PendingAuthRequest {
	id: string;
	appId: string;
	appName: string;
	appVersion: string;
	code: string;
	createdAt: number;
}

type IssuedCode = {
	appId: string;
	appName: string;
	appVersion: string;
	code: string;
	createdAt: number;
	expireTimer: ReturnType<typeof setTimeout>;
};

type WaitingApproval = PendingAuthRequest & {
	resolve: (token: string) => void;
	reject: (err: Error) => void;
	timer: ReturnType<typeof setTimeout>;
};

/**
 * Global companion-style pairing for the app.
 * Bearer = encryption.js token with client state (purpose `ytm.auth.client`).
 * Paired list persists in encrypted store for revoke / UI; codes are memory-only.
 */
export class AppAuthManager extends EventEmitter {
	private codes = new Map<string, IssuedCode>();
	private waiting = new Map<string, WaitingApproval>();
	private clients = new Map<string, AuthClientRecord>();

	loadClients(clients: AuthClientRecord[] | undefined | null) {
		this.clients.clear();
		for (const client of clients ?? []) {
			if (!client?.appId || !client?.token) continue;
			this.clients.set(client.appId, client);
		}
		this.emit("clients", this.listClients());
	}

	listClients(): AuthClientRecord[] {
		return [...this.clients.values()].sort((a, b) => b.createdAt - a.createdAt);
	}

	listPending(): PendingAuthRequest[] {
		return [...this.waiting.values()].map(({ resolve: _r, reject: _j, timer: _t, ...rest }) => rest);
	}

	isValidToken(token: string | null | undefined): boolean {
		if (!token) return false;
		const state = parseAuthToken(token);
		if (!state) return false;
		const client = this.clients.get(state.appId);
		return client?.token === token;
	}

	requestCode(input: { appId: string; appName: string; appVersion: string }): { code: string } {
		const appId = normalizeAppId(input.appId);
		const appName = normalizeAppName(input.appName);
		const appVersion = normalizeAppVersion(input.appVersion);

		const existing = this.codes.get(appId);
		if (existing) clearTimeout(existing.expireTimer);

		const code = createAuthCode();
		const createdAt = Date.now();
		this.codes.set(appId, {
			appId,
			appName,
			appVersion,
			code,
			createdAt,
			expireTimer: setTimeout(() => this.codes.delete(appId), AUTH_CODE_TTL_MS),
		});

		return { code };
	}

	async requestToken(input: { appId: string; code: string }): Promise<{ token: string }> {
		const appId = normalizeAppId(input.appId);
		const code = String(input.code ?? "")
			.trim()
			.toUpperCase();

		const issued = this.codes.get(appId);
		if (!issued || issued.code !== code) throw new Error("Invalid or expired auth code");

		clearTimeout(issued.expireTimer);
		this.codes.delete(appId);

		for (const [id, pending] of this.waiting) {
			if (pending.appId === appId) {
				clearTimeout(pending.timer);
				pending.reject(new Error("Superseded by a new auth request"));
				this.waiting.delete(id);
			}
		}

		const id = createId();
		const record: PendingAuthRequest = {
			id,
			appId,
			appName: issued.appName,
			appVersion: issued.appVersion,
			code,
			createdAt: Date.now(),
		};

		return await new Promise<{ token: string }>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.waiting.delete(id);
				reject(new Error("Authorization timed out — user did not approve in time"));
				this.emit("resolved", record);
			}, AUTH_REQUEST_TIMEOUT_MS);

			this.waiting.set(id, {
				...record,
				timer,
				resolve: (token: string) => {
					clearTimeout(timer);
					this.waiting.delete(id);
					resolve({ token });
					this.emit("resolved", record);
				},
				reject: (err: Error) => {
					clearTimeout(timer);
					this.waiting.delete(id);
					reject(err);
					this.emit("resolved", record);
				},
			});

			this.emit("pending", record);
		});
	}

	approve(id: string): AuthClientRecord | null {
		const pending = this.waiting.get(id);
		if (!pending) return null;

		const createdAt = Date.now();
		const token = createAuthToken({
			appId: pending.appId,
			appName: pending.appName,
			appVersion: pending.appVersion,
			createdAt,
		});
		const client: AuthClientRecord = {
			appId: pending.appId,
			appName: pending.appName,
			appVersion: pending.appVersion,
			createdAt,
			token,
		};
		this.clients.set(client.appId, client);
		pending.resolve(token);
		this.emit("clients", this.listClients());
		return client;
	}

	deny(id: string): boolean {
		const pending = this.waiting.get(id);
		if (!pending) return false;
		pending.reject(new Error("Authorization denied by user"));
		return true;
	}

	revoke(appId: string): boolean {
		const removed = this.clients.delete(normalizeAppId(appId));
		if (removed) this.emit("clients", this.listClients());
		return removed;
	}

	revokeAll() {
		this.clients.clear();
		this.emit("clients", this.listClients());
	}

	/** Manually create / replace a paired client and return record including token. */
	createManual(input: { appId: string; appName: string; appVersion?: string }): AuthClientRecord {
		const appId = normalizeAppId(input.appId);
		const appName = normalizeAppName(input.appName);
		const appVersion = normalizeAppVersion(input.appVersion?.trim() ? input.appVersion : "1.0.0");
		const createdAt = Date.now();
		const token = createAuthToken({ appId, appName, appVersion, createdAt });
		const client: AuthClientRecord = { appId, appName, appVersion, createdAt, token };
		this.clients.set(appId, client);
		this.emit("clients", this.listClients());
		return client;
	}

	/** Return stored token for a paired client (for copy / manual paste). */
	getClientToken(appId: string): string | null {
		return this.clients.get(normalizeAppId(appId))?.token ?? null;
	}
}

function createAuthCode(): string {
	return randomBytes(3).toString("hex").toUpperCase().slice(0, 6);
}

function normalizeAppId(value: string): string {
	const appId = String(value ?? "")
		.trim()
		.toLowerCase();
	if (!/^[a-z0-9]{2,32}$/.test(appId)) {
		throw new Error("appId must be 2-32 lowercase alphanumeric characters");
	}
	return appId;
}

function normalizeAppName(value: string): string {
	const appName = String(value ?? "").trim();
	if (appName.length < 2 || appName.length > 48) {
		throw new Error("appName must be between 2 and 48 characters");
	}
	return appName;
}

function normalizeAppVersion(value: string): string {
	const appVersion = String(value ?? "").trim();
	if (!/^\d+\.\d+\.\d+([\w.-]*)$/.test(appVersion)) {
		throw new Error("appVersion must be semver-compatible");
	}
	return appVersion;
}

export const appAuth = new AppAuthManager();
