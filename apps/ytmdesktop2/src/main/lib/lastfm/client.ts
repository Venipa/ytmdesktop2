import { createFetch } from "@better-fetch/fetch";
import { createHash } from "crypto";

const API_ROOT = "https://ws.audioscrobbler.com/2.0";
const USER_AGENT = "ytmd (github.com/Venipa/ytmdesktop2)";

const lastfmFetch = createFetch({
	baseURL: API_ROOT,
	headers: {
		"user-agent": USER_AGENT,
	},
});

type HttpMethod = "GET" | "POST";

interface LastFmApiErrorBody {
	error?: number;
	message?: string;
}

export class LastFMClient {
	private token: string | null = null;
	private session: string | null = null;
	private sessionName: string | null = null;
	private lastError: unknown = null;

	constructor(private key: { api: string; secret: string }) {}

	private md5(value: string): string {
		return createHash("md5").update(value, "utf8").digest("hex");
	}

	/** Sign all params except `format` / `callback` (Last.fm auth spec). */
	private buildSignedParams(params: Record<string, string>): Record<string, string> {
		const sortedKeys = Object.keys(params).sort();
		let sigBase = "";
		for (const key of sortedKeys) {
			if (key === "format" || key === "callback") continue;
			sigBase += key + params[key];
		}
		sigBase += this.key.secret;
		return {
			...params,
			api_sig: this.md5(sigBase),
			format: "json",
		};
	}

	private toParamRecord(extra: Record<string, string | number | undefined>): Record<string, string> {
		const params: Record<string, string> = {
			api_key: this.key.api,
		};
		for (const [key, value] of Object.entries(extra)) {
			if (value === undefined || value === null) continue;
			params[key] = String(value);
		}
		return params;
	}

	private async callMethod<T>(
		method: string,
		httpMethod: HttpMethod,
		extra: Record<string, string | number | undefined> = {},
		options: { includeToken?: boolean; expectError?: boolean } = {},
	): Promise<T> {
		const params = this.toParamRecord({ ...extra, method });
		if (options.includeToken) {
			if (!this.token) throw new Error("Invalid token");
			params.token = this.token;
		}

		const needsSig = method !== "auth.getToken";
		const requestParams = needsSig ? this.buildSignedParams(params) : { ...params, format: "json" };

		if (!options.expectError) this.lastError = null;

		try {
			const { data, error } =
				httpMethod === "POST"
					? await lastfmFetch<T & LastFmApiErrorBody>("/", {
							method: "POST",
							headers: {
								"content-type": "application/x-www-form-urlencoded",
							},
							body: requestParams,
						})
					: await lastfmFetch<T & LastFmApiErrorBody>("/", {
							method: "GET",
							query: requestParams,
						});

			if (error) {
				throw Object.assign(new Error(`Last.fm HTTP ${error.status}`), { response: error });
			}
			if (!data) {
				throw new Error("Last.fm empty response");
			}
			if (data.error != null) {
				throw Object.assign(new Error(data.message || `Last.fm error ${data.error}`), { code: data.error });
			}

			this.lastError = null;
			return data;
		} catch (err) {
			if (!options.expectError) this.lastError = err;
			throw err;
		}
	}

	async authorize() {
		const data = await this.callMethod<{ token: string }>("auth.getToken", "GET");
		return (this.token = data.token);
	}

	async getSession() {
		const { session: s } = await this.callMethod<{ session: { name: string; key: string } }>("auth.getSession", "GET", {}, { includeToken: true });
		this.sessionName = s.name;
		this.session = s.key;
		this.token = null;
		return this.session;
	}

	/** Poll while auth window open — null until user approves; does not sticky-error. */
	async tryGetSession(): Promise<string | null> {
		try {
			const { session: s } = await this.callMethod<{ session: { name: string; key: string } }>(
				"auth.getSession",
				"GET",
				{},
				{ includeToken: true, expectError: true },
			);
			this.sessionName = s.name;
			this.session = s.key;
			this.token = null;
			this.lastError = null;
			return this.session;
		} catch {
			return null;
		}
	}

	/** True if session key still accepted by Last.fm (error 9 = expired). */
	async validateSession(): Promise<boolean> {
		if (!this.session) return false;
		try {
			const data = await this.callMethod<{ user?: { name?: string } }>(
				"user.getInfo",
				"GET",
				{ sk: this.session },
				{ expectError: true },
			);
			if (data.user?.name) this.sessionName = data.user.name;
			this.lastError = null;
			return true;
		} catch {
			return false;
		}
	}

	async updateNowPlaying(track: { artist: string; track: string; album?: string; duration?: number }) {
		if (!this.session) throw new Error("Invalid session");
		return await this.callMethod("track.updateNowPlaying", "POST", {
			sk: this.session,
			artist: track.artist,
			track: track.track,
			...(track.album ? { album: track.album } : {}),
			...(track.duration != null ? { duration: track.duration } : {}),
		});
	}

	async scrobble(track: { artist: string; track: string; timestamp: number; album?: string; duration?: number }) {
		if (!this.session) throw new Error("Invalid session");
		return await this.callMethod("track.scrobble", "POST", {
			sk: this.session,
			artist: track.artist,
			track: track.track,
			timestamp: Math.floor(track.timestamp),
			...(track.album ? { album: track.album } : {}),
			...(track.duration != null ? { duration: track.duration } : {}),
		});
	}

	getUserAuthorizeUrl() {
		if (!this.token) throw new Error("Invalid token");
		return `https://www.last.fm/api/auth?api_key=${this.key.api}&token=${this.token}`;
	}

	getName() {
		if (!this.session) return null;
		return this.sessionName;
	}

	hasError() {
		return !!this.lastError;
	}

	isConnected() {
		return !!this.session;
	}

	setAuthorize({ token, session, name }: { token: string | null; session?: string | null; name?: string | null }) {
		this.token = token ?? null;
		this.session = session ?? null;
		if (!this.session) this.sessionName = null;
		else this.sessionName = name ?? null;
		this.lastError = null;
	}
}
