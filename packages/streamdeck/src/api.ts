export type GlobalSettings = {
	host?: string;
	port?: number;
	token?: string;
	authCode?: string;
	status?: string;
	[key: string]: string | number | boolean | null | undefined;
};

const APP_ID = "ytmdesktop2streamdeck";
const APP_NAME = "YTMDesktop2 Stream Deck";
const APP_VERSION = "1.0.0";

export class YtmApiClient {
	constructor(private getSettings: () => Promise<GlobalSettings>) {}

	private async baseUrl(): Promise<string> {
		const settings = await this.getSettings();
		const host = (settings.host || "127.0.0.1").trim() || "127.0.0.1";
		const port = Number(settings.port) || 13091;
		return `http://${host}:${port}`;
	}

	private async headers(): Promise<HeadersInit> {
		const settings = await this.getSettings();
		const headers: Record<string, string> = { "Content-Type": "application/json" };
		if (settings.token) headers.Authorization = `Bearer ${String(settings.token)}`;
		return headers;
	}

	async ping(): Promise<{ ok: boolean; authRequired?: boolean; error?: string }> {
		try {
			const res = await fetch(await this.baseUrl(), { method: "GET" });
			if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
			const body = (await res.json()) as { authRequired?: boolean };
			return { ok: true, authRequired: !!body.authRequired };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	}

	async authorize(setSettings: (partial: GlobalSettings) => Promise<void>): Promise<{ code?: string; token?: string; error?: string }> {
		try {
			const base = await this.baseUrl();
			const codeRes = await fetch(`${base}/auth/requestcode`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ appId: APP_ID, appName: APP_NAME, appVersion: APP_VERSION }),
			});
			const codeBody = (await codeRes.json()) as { code?: string; error?: string };
			if (!codeRes.ok || !codeBody.code) {
				return { error: codeBody.error || `Failed to request code (${codeRes.status})` };
			}
			await setSettings({ authCode: codeBody.code, status: `Code ${codeBody.code} — approve in YTMDesktop2` });

			const tokenRes = await fetch(`${base}/auth/request`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ appId: APP_ID, code: codeBody.code }),
			});
			const tokenBody = (await tokenRes.json()) as { token?: string; error?: string };
			if (!tokenRes.ok || !tokenBody.token) {
				await setSettings({ status: tokenBody.error || "Authorization denied or timed out" });
				return { code: codeBody.code, error: tokenBody.error || `Auth failed (${tokenRes.status})` };
			}
			await setSettings({ token: tokenBody.token, authCode: undefined, status: "Connected" });
			return { code: codeBody.code, token: tokenBody.token };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			await setSettings({ status: message });
			return { error: message };
		}
	}

	async post(path: string, body?: unknown): Promise<unknown> {
		const res = await fetch(`${await this.baseUrl()}${path}`, {
			method: "POST",
			headers: await this.headers(),
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		if (!res.ok) {
			const text = await res.text().catch(() => "");
			throw new Error(text || `HTTP ${res.status}`);
		}
		return await res.json().catch(() => null);
	}

	async getTrack(): Promise<{ title?: string; author?: string } | null> {
		const res = await fetch(`${await this.baseUrl()}/track`, {
			method: "GET",
			headers: await this.headers(),
		});
		if (!res.ok) return null;
		const track = (await res.json()) as { video?: { title?: string; author?: string } } | null;
		if (!track?.video) return null;
		return { title: track.video.title, author: track.video.author };
	}
}
