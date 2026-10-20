import { AfterInit, BaseProvider, OnInit } from "@main/core/baseProvider";
import { emitAppToast } from "@main/lib/appToast";
import { stringifyJson } from "@main/lib/json";
import { LASTFM_KEYTAR_SESSION, LASTFM_KEYTAR_TOKEN } from "@main/lib/keytar";
import { LastFMClient } from "@main/lib/lastfm";
import secureStore from "@main/lib/secureStore";
import IPC_EVENT_NAMES from "@shared/constants/eventNames";
import { YtmdLink } from "@shared/protocol/ytmdProtocol";
import { lastFmListenKey } from "@shared/track/lastfmTrackSession";
import { TrackData } from "@shared/track/trackData";
import { App, shell } from "electron";
import { LastFMSettings } from "ytmd";

const AUTH_POLL_MS = 1500;
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

const lastFmClient =
	(import.meta.env.VITE_LASTFM_SECRET &&
		new LastFMClient({
			api: import.meta.env.VITE_LASTFM_API,
			secret: import.meta.env.VITE_LASTFM_SECRET,
		})) ||
	null;

export default class LastFMProvider extends BaseProvider implements AfterInit, OnInit {
	/** `${videoId}:${floor(startedAt)}` — same track can re-listen after loop. */
	private lastNowPlayingKey: string | null = null;
	private lastScrobbledKey: string | null = null;
	/** Serialize NP/scrobble so a late scrobble cannot clear a newer Now Playing. */
	private writeChain: Promise<void> = Promise.resolve();
	private authProgress = false;
	private authPollTimer: ReturnType<typeof setInterval> | null = null;
	private authDeadline: ReturnType<typeof setTimeout> | null = null;
	private authGen = 0;
	/** `reauth` cancel keeps enabled=true; first-time connect cancel flips off. */
	private authMode: "connect" | "reauth" | null = null;
	/** Reauth enables setting without letting toggle handler start a second auth. */
	private skipNextEnableAuth = false;

	constructor(private app: App) {
		super("lastfm");
	}
	get client() {
		return lastFmClient;
	}
	async OnInit() {
		if (!lastFmClient) {
			this.getProvider("settings").set("lastfm.enabled", false);
			return;
		}
		const lastfm = this.getProvider("settings").get("lastfm") as LastFMSettings;
		if (lastfm.enabled) {
			const session = await secureStore.get<string>(LASTFM_KEYTAR_SESSION);
			if (session) {
				// Session key alone is enough for signed write calls — drop leftover auth token
				this.client.setAuthorize({
					token: null,
					session,
					name: lastfm.name ?? null,
				});
				void secureStore.delete(LASTFM_KEYTAR_TOKEN);
				this.logger.debug("restored lastfm session", { name: lastfm.name });
			} else {
				const creds = await secureStore.getAll();
				this.logger.warn("lastfm.enabled but no session in secureStore — re-auth required", {
					credentialAccounts: creds.map((c) => c.account),
				});
			}
		}
	}
	async AfterInit() {
		if (!this.views.toolbarView?.webContents.isLoading()) this.sendState();
		this.views.toolbarView.webContents.on("did-finish-load", () => this.sendState());
		// No debounce — enable/disable must react immediately
		this.getProvider("settings").onSettingChange("lastfm.enabled", (value) => void this.__onToggleEnabled(!!value));
	}

	private async __onToggleEnabled(enabled: boolean) {
		if (!this.client) return;
		if (enabled) {
			if (this.skipNextEnableAuth) {
				this.skipNextEnableAuth = false;
				this.sendState();
				return;
			}
			if (this.authProgress) {
				this.sendState();
				return;
			}
			if (this.client.isConnected()) {
				const stillValid = await this.client.validateSession();
				if (stillValid) {
					this.sendState();
					return;
				}
				this.logger.warn("lastfm in-memory session expired — clearing");
				await this.clearStoredSession();
			} else {
				const restored = await this.restoreAndValidateSession();
				if (restored) {
					this.logger.debug("lastfm re-enabled with stored session");
					this.sendState();
					return;
				}
			}
			await this.handleLastFMAuth();
			return;
		}
		this.pauseIntegration();
	}

	private bumpAuthGen() {
		this.authGen += 1;
		return this.authGen;
	}

	private stopAuthPoll() {
		if (this.authPollTimer) {
			clearInterval(this.authPollTimer);
			this.authPollTimer = null;
		}
		if (this.authDeadline) {
			clearTimeout(this.authDeadline);
			this.authDeadline = null;
		}
	}

	/** Disable scrobbling; keep session/credentials for quick re-enable. */
	private pauseIntegration() {
		this.bumpAuthGen();
		this.stopAuthPoll();
		this.authProgress = false;
		this.authMode = null;
		this.lastNowPlayingKey = null;
		this.lastScrobbledKey = null;
		this.sendState();
	}

	private async clearStoredSession() {
		if (this.client) {
			this.client.setAuthorize({ token: null, session: null });
		}
		const settings = this.getProvider("settings");
		settings.set("lastfm.name", null);
		await Promise.all([secureStore.delete(LASTFM_KEYTAR_SESSION), secureStore.delete(LASTFM_KEYTAR_TOKEN)]);
	}

	/** Load session from store and ping Last.fm. False → need interactive auth. */
	private async restoreAndValidateSession(): Promise<boolean> {
		if (!this.client) return false;
		const session = await secureStore.get<string>(LASTFM_KEYTAR_SESSION);
		if (!session) return false;
		const lastfm = this.getProvider("settings").get<LastFMSettings>("lastfm");
		this.client.setAuthorize({
			token: null,
			session,
			name: lastfm?.name ?? null,
		});
		const valid = await this.client.validateSession();
		if (!valid) {
			this.logger.warn("lastfm stored session invalid — need re-auth");
			await this.clearStoredSession();
			return false;
		}
		const name = this.client.getName();
		if (name) {
			this.getProvider("settings").set("lastfm.name", name);
		}
		return true;
	}

	/** Full logout — wipe session (unused by toggle; kept for explicit disconnect). */
	async disconnect() {
		this.pauseIntegration();
		await this.clearStoredSession();
		this.sendState();
	}

	private async finishAuth(sessionToken: string, gen: number) {
		if (gen !== this.authGen || !this.authProgress || !this.client) return;
		this.stopAuthPoll();
		this.authProgress = false;
		this.authMode = null;
		await secureStore.set(LASTFM_KEYTAR_SESSION, sessionToken);
		await secureStore.delete(LASTFM_KEYTAR_TOKEN);
		this.logger.debug(`[Auth]> Authenticated: ${sessionToken.slice(0, 6)}…`);
		const settings = this.getProvider("settings");
		settings.set("lastfm.enabled", true);
		settings.set("lastfm.name", this.client.getName() || null);
		settings.saveToDrive();
		this.sendState();
		emitAppToast(this.windowContext, { type: "success", message: "Last.fm connected" });
	}

	private cancelAuth(reason: "timeout" | "abort") {
		this.bumpAuthGen();
		this.stopAuthPoll();
		const modeAtClose = this.authMode;
		this.authProgress = false;
		this.authMode = null;
		const settings = this.getProvider("settings");
		if (!this.client?.isConnected() && modeAtClose !== "reauth") {
			settings.set("lastfm.enabled", false);
		}
		this.sendState();
		if (reason === "timeout") {
			emitAppToast(this.windowContext, { type: "error", message: "Last.fm authorization timed out" });
		}
	}

	async handleAuthCallback(token?: string) {
		if (!this.client || !this.authProgress) {
			this.logger.debug("lastfm callback ignored — not awaiting auth");
			return;
		}
		const pending = this.client.getPendingToken();
		if (token && pending && token !== pending) {
			this.logger.warn("lastfm callback token mismatch");
			return;
		}
		try {
			const sessionToken = await this.client.getSession();
			if (sessionToken) await this.finishAuth(sessionToken, this.authGen);
		} catch (err) {
			this.logger.error(err);
		}
	}

	private async authorizeSession(mode: "connect" | "reauth" = "connect") {
		if (!this.client) return;
		if (this.authProgress) return;
		const gen = this.bumpAuthGen();
		this.authMode = mode;
		await this.client.authorize();
		const authUrl = this.client.getUserAuthorizeUrl(YtmdLink.integrationCallback("lastfm"));
		if (!authUrl.startsWith("https://www.last.fm/")) {
			throw new Error("Last.fm auth URL rejected");
		}
		await shell.openExternal(authUrl);

		this.authProgress = true;
		this.sendState();

		this.authPollTimer = setInterval(() => {
			if (gen !== this.authGen || !this.client || !this.authProgress) return;
			void this.client.tryGetSession().then((sessionToken) => {
				if (sessionToken) void this.finishAuth(sessionToken, gen);
			});
		}, AUTH_POLL_MS);

		this.authDeadline = setTimeout(() => {
			if (gen !== this.authGen || !this.authProgress) return;
			this.cancelAuth("timeout");
		}, AUTH_TIMEOUT_MS);
	}
	getState() {
		if (!this.client) return { connected: false, name: null, processing: false, error: true };
		const lastfm = this.getProvider("settings")?.get<LastFMSettings>("lastfm");
		const enabled = !!lastfm?.enabled;
		return {
			connected: enabled && this.client.isConnected(),
			name: this.client.getName() || (enabled ? lastfm.name : null),
			error: this.client.hasError(),
			processing: this.authProgress,
		};
	}
	sendState() {
		this.windowContext.sendToAllViews(IPC_EVENT_NAMES.LAST_FM_STATUS, this.getState());
	}
	async handleLastFMState() {
		return this.getState();
	}
	async handleLastFMProfile() {
		if (!this.client?.isConnected()) return;
		const username = this.client.getName() || this.getProvider("settings")?.instance.lastfm.name;
		if (!username) return;
		return await shell.openExternal(`https://www.last.fm/user/${encodeURIComponent(username)}/`);
	}
	async handleLastFMAuth() {
		return await this.authorizeSession("connect")
			.then(() => true)
			.catch((err) => {
				this.logger.error(err);
				this.authMode = null;
				return false;
			});
	}

	/** Wipe session and open Last.fm auth (account switch / fix expired). */
	async handleLastFMReauth() {
		if (!this.client) return false;
		if (this.authProgress) return false;
		this.lastNowPlayingKey = null;
		this.lastScrobbledKey = null;
		await this.clearStoredSession();
		const settings = this.getProvider("settings");
		if (!settings.get<LastFMSettings>("lastfm")?.enabled) {
			this.skipNextEnableAuth = true;
			settings.set("lastfm.enabled", true);
			settings.saveToDrive();
		}
		this.sendState();
		return await this.authorizeSession("reauth")
			.then(() => true)
			.catch((err) => {
				this.logger.error(err);
				this.authMode = null;
				return false;
			});
	}

	async handleLastFMToggle(_, state: boolean) {
		if (state === undefined) return null;
		const settings = this.getProvider("settings");
		// Setting change drives connect/disconnect via onSettingChange
		settings.set("lastfm.enabled", !!state);
		settings.saveToDrive();
		return this.getState();
	}

	private enqueueWrite(task: () => Promise<void>): Promise<void> {
		const run = this.writeChain.then(task, task);
		this.writeChain = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}

	async handleTrackStart(track: TrackData, opts?: { force?: boolean; epoch?: number }) {
		if (!this.client?.isConnected()) {
			this.logger.debug("lastfm.handleTrackStart", track.video.videoId, "not connected");
			return;
		}
		const videoId = track.video.videoId;
		const listenKey = lastFmListenKey(videoId, Number(track.meta.startedAt) || 0, opts?.epoch);
		// force: resume after long pause / relisten — Last.fm drops Now Playing while idle
		if (!opts?.force && this.lastNowPlayingKey === listenKey) {
			this.logger.debug("lastfm.handleTrackStart skip duplicate", listenKey);
			return;
		}
		this.lastNowPlayingKey = listenKey;
		this.logger.debug("isAlbum", !!track.music?.album);
		this.windowContext.sendToAllViews(IPC_EVENT_NAMES.LAST_FM_SUBMIT_STATE, "start");
		await this.enqueueWrite(async () => {
			try {
				const d = await this.client!.updateNowPlaying({
					artist: track.video.author,
					track: track.video.title,
					duration: track.meta.duration,
					...(track.music?.album && { album: track.music.album }),
				});
				this.logger.debug(stringifyJson(d));
				this.sendState();
				this.windowContext.sendToAllViews(IPC_EVENT_NAMES.LAST_FM_SUBMIT_STATE, true);
			} catch (err) {
				this.logger.error(err);
				this.sendState();
				this.windowContext.sendToAllViews(IPC_EVENT_NAMES.LAST_FM_SUBMIT_STATE, false);
			}
		});
	}

	/** @returns false when skipped (duplicate) or not connected */
	async handleTrackChange(track: TrackData, opts?: { epoch?: number }): Promise<boolean> {
		if (!this.client?.isConnected()) {
			this.logger.debug("lastfm.handleTrackChange", track.video.videoId, "not connected");
			return false;
		}
		const videoId = track.video.videoId;
		const listenKey = lastFmListenKey(videoId, Number(track.meta.startedAt) || 0, opts?.epoch);
		if (this.lastScrobbledKey === listenKey) {
			this.logger.debug("lastfm.handleTrackChange skip duplicate", listenKey);
			return false;
		}
		this.lastScrobbledKey = listenKey;
		this.logger.debug("isAlbum", !!track.music?.album);
		this.windowContext.sendToAllViews(IPC_EVENT_NAMES.LAST_FM_SUBMIT_STATE, "change");
		await this.enqueueWrite(async () => {
			try {
				const d = await this.client!.scrobble({
					artist: track.video.author,
					track: track.video.title,
					timestamp: track.meta.startedAt,
					duration: track.meta.duration,
					...(track.music?.album && { album: track.music.album }),
				});
				this.logger.debug(stringifyJson(d));
				this.sendState();
				this.windowContext.sendToAllViews(IPC_EVENT_NAMES.LAST_FM_SUBMIT_STATE, true);
			} catch (err) {
				this.logger.error(err);
				this.sendState();
				this.windowContext.sendToAllViews(IPC_EVENT_NAMES.LAST_FM_SUBMIT_STATE, false);
			}
		});
		return true;
	}
}
