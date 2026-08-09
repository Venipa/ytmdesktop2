import { createFetch } from "@better-fetch/fetch";

export type GlobalSettings = {
	host?: string;
	port?: number;
	token?: string;
	authCode?: string | null;
	status?: string;
	[key: string]: string | number | boolean | null | undefined;
};

const APP_ID = "ytmdesktop2streamdeck";
const APP_NAME = "YTMDesktop2 Stream Deck";
const APP_VERSION = "1.0.0";

type YtmFetch = ReturnType<typeof createFetch>;

interface PingBody {
	authRequired?: boolean;
}

interface AuthCodeBody {
	code?: string;
	error?: string;
}

interface AuthTokenBody {
	token?: string;
	error?: string;
}

interface TrackBody {
	video?: { title?: string; author?: string };
}

export class YtmApiClient {
	private cachedKey: string | null = null;
	private cachedClient: YtmFetch | null = null;

	constructor(private getSettings: () => Promise<GlobalSettings>) {}

	private async baseUrl(): Promise<string> {
		const settings = await this.getSettings();
		const host = (settings.host || "127.0.0.1").trim() || "127.0.0.1";
		const port = Number(settings.port) || 13091;
		return `http://${host}:${port}`;
	}

	private async client(includeAuth = true): Promise<YtmFetch> {
		const settings = await this.getSettings();
		const baseURL = await this.baseUrl();
		const token = includeAuth && settings.token ? String(settings.token) : "";
		const cacheKey = `${baseURL}|auth:${includeAuth ? "1" : "0"}|token:${token}`;

		if (this.cachedClient && this.cachedKey === cacheKey) {
			return this.cachedClient;
		}

		const headers: Record<string, string> = { "Content-Type": "application/json" };
		if (token) headers.Authorization = `Bearer ${token}`;

		const client = createFetch({
			baseURL,
			throw: false as const,
			headers,
		});
		this.cachedKey = cacheKey;
		this.cachedClient = client;
		return client;
	}

	async ping(): Promise<{ ok: boolean; authRequired?: boolean; error?: string }> {
		try {
			const api = await this.client(false);
			const { data, error } = await api<PingBody>("/", { method: "GET" });
			if (error) return { ok: false, error: `HTTP ${error.status}` };
			return { ok: true, authRequired: !!data?.authRequired };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	}

	async authorize(setSettings: (partial: GlobalSettings) => Promise<void>): Promise<{ code?: string; token?: string; error?: string }> {
		try {
			const api = await this.client(false);
			const { data: codeBody, error: codeError } = await api<AuthCodeBody>("/auth/requestcode", {
				method: "POST",
				body: { appId: APP_ID, appName: APP_NAME, appVersion: APP_VERSION },
			});
			if (codeError || !codeBody?.code) {
				return { error: codeBody?.error || `Failed to request code (${codeError?.status ?? "unknown"})` };
			}
			await setSettings({ authCode: codeBody.code, status: `Code ${codeBody.code} — approve in YTMDesktop2` });

			const { data: tokenBody, error: tokenError } = await api<AuthTokenBody>("/auth/request", {
				method: "POST",
				body: { appId: APP_ID, code: codeBody.code },
			});
			if (tokenError || !tokenBody?.token) {
				await setSettings({ status: tokenBody?.error || "Authorization denied or timed out" });
				return { code: codeBody.code, error: tokenBody?.error || `Auth failed (${tokenError?.status ?? "unknown"})` };
			}
			this.cachedKey = null;
			this.cachedClient = null;
			await setSettings({ token: tokenBody.token, status: "Connected", authCode: null });
			return { code: codeBody.code, token: tokenBody.token };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			await setSettings({ status: message });
			return { error: message };
		}
	}

	async post(path: string, body?: unknown): Promise<unknown> {
		const api = await this.client();
		const { data, error } = await api<unknown>(path, {
			method: "POST",
			...(body !== undefined ? { body } : {}),
		});
		if (error) {
			throw new Error(error.message || error.statusText || `HTTP ${error.status}`);
		}
		return data;
	}

	async getTrack(): Promise<{ title?: string; author?: string } | null> {
		const api = await this.client();
		const { data, error } = await api<TrackBody | null>("/track", { method: "GET" });
		if (error || !data?.video) return null;
		return {
			...(data.video.title != null ? { title: data.video.title } : {}),
			...(data.video.author != null ? { author: data.video.author } : {}),
		};
	}
}
