import { AfterInit, BaseProvider, OnInit } from "@main/core/baseProvider";
import { parseJson, stringifyJson } from "@main/lib/json";
import { LASTFM_KEYTAR_SESSION, LASTFM_KEYTAR_TOKEN } from "@main/lib/keytar";
import { LastFMClient } from "@main/lib/lastfm";
import secureStore from "@main/lib/secureStore";
import { appIconPath } from "@main/windows/windowUtils";
import IPC_EVENT_NAMES from "@shared/constants/eventNames";
import { TrackData } from "@shared/track/trackData";
import { escapeHTML } from "@shared/utils/string";
import { App, BrowserWindow, shell } from "electron";
import { LastFMSettings } from "ytmd";

export interface LastFMUserState {
	siteSection: string;
	pageType: string;
	pageName: string;
	nativeEventTracking: boolean;
	userState: string;
	userType: string;
	userId: string;
}
const lastFmClient =
	(import.meta.env.VITE_LASTFM_SECRET &&
		new LastFMClient({
			api: import.meta.env.VITE_LASTFM_API,
			secret: import.meta.env.VITE_LASTFM_SECRET,
		})) ||
	null;

export default class LastFMProvider extends BaseProvider implements AfterInit, OnInit {
	private lastNowPlayingId: string | null = null;
	private lastScrobbledId: string | null = null;
	private authProgress = false;
	private authWindow: BrowserWindow | null = null;

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
			const creds = await secureStore.getAll();
			const lastFMState = creds.reduce(
				(acc, r) => {
					if (r.account === LASTFM_KEYTAR_TOKEN) acc.token = r.password;
					else if (r.account === LASTFM_KEYTAR_SESSION) acc.session = r.password;
					return acc;
				},
				{} as any as { token: string; session: string },
			);
			if (lastFMState.session) {
				this.client.setAuthorize({
					token: lastFMState.token,
					session: lastFMState.session,
					name: lastfm.name ? encodeURIComponent(lastfm.name!) : "",
				});
				this.logger.debug("restored lastfm session", { name: lastfm.name, hasToken: !!lastFMState.token });
			} else {
				this.logger.warn("lastfm.enabled but no session in secureStore — re-auth required", {
					credentialAccounts: creds.map((c) => c.account),
				});
			}
		}
	}
	async AfterInit() {
		if (!this.views.toolbarView?.webContents.isLoading()) this.sendState();
		this.views.toolbarView.webContents.on("did-finish-load", () => this.sendState());
		// No debounce — disable must clear session / close auth immediately
		this.getProvider("settings").onSettingChange("lastfm.enabled", (value) => void this.__onToggleEnabled(!!value));
	}

	private async __onToggleEnabled(enabled: boolean) {
		if (!this.client) return;
		if (enabled) {
			if (this.client.isConnected() || this.authProgress) {
				this.sendState();
				return;
			}
			await this.handleLastFMAuth();
			return;
		}
		await this.disconnect();
	}

	/** Tear down auth window, session, and stored credentials. */
	async disconnect() {
		if (this.authWindow && !this.authWindow.isDestroyed()) {
			this.authWindow.close();
		}
		this.authWindow = null;
		this.authProgress = false;
		this.lastNowPlayingId = null;
		this.lastScrobbledId = null;
		if (this.client) {
			this.client.setAuthorize({ token: null, session: null });
		}
		const settings = this.getProvider("settings");
		settings.set("lastfm.name", null);
		await Promise.all([secureStore.delete(LASTFM_KEYTAR_SESSION), secureStore.delete(LASTFM_KEYTAR_TOKEN)]);
		this.sendState();
	}

	private async authorizeSession() {
		if (!this.client) return;
		if (this.authProgress) return;
		const token = await this.client.authorize();
		const win = new BrowserWindow({
			width: 480,
			height: 600,
			minWidth: 480,
			minHeight: 600,
			alwaysOnTop: true,
			parent: this.windowContext.main,
			title: "LastFM Authorize",
			icon: appIconPath,
			paintWhenInitiallyHidden: true,
			show: false,
			autoHideMenuBar: true,
			center: true,
			resizable: false,
			minimizable: false,
			maximizable: false,
			fullscreenable: false,
			modal: true,
		});
		this.authWindow = win;
		await win.loadURL(this.client.getUserAuthorizeUrl());
		const hasSuccessInfo = () => win.webContents.executeJavaScript(`!!document.querySelector("#mantle_skin .alert.alert-success")`);
		const settings = this.getProvider("settings");
		win.webContents.on("did-navigate", async (ev, url, code, status) => {
			this.logger.debug(`[URL]> ${url}, ${code}, ${status}`);
			if (await hasSuccessInfo()) {
				const { userState }: LastFMUserState = await win.webContents
					.executeJavaScript(`document.getElementById("tlmdata")?.dataset?.tealiumData`)
					.then(parseJson<LastFMUserState>)
					.catch(() => ({}) as any);
				this.logger.debug(`[Auth]> User: ${stringifyJson(userState)}`);
				if (userState === "authenticated") {
					await secureStore.set(LASTFM_KEYTAR_TOKEN, token);
					const sessionToken = await this.client.getSession();
					if (sessionToken) {
						await secureStore.set(LASTFM_KEYTAR_SESSION, sessionToken);
						if (!win.isDestroyed()) win.close();
					}

					this.logger.debug(`[Auth]> Authenticated: ${sessionToken}`);
					settings.set("lastfm.enabled", true);
					settings.set("lastfm.name", escapeHTML(this.client.getName() || null));
					settings.saveToDrive();
				}
			}
			this.sendState();
		});
		win.show();
		this.authProgress = true;
		this.sendState();
		win.once("closed", () => {
			this.authWindow = null;
			this.authProgress = false;
			// Auth cancelled without session — flip enabled back off
			if (!this.client?.isConnected()) {
				settings.set("lastfm.enabled", false);
			}
			this.sendState();
		});
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
		return await shell.openExternal(`https://www.last.fm/user/${escapeHTML(username)}/`);
	}
	async handleLastFMAuth() {
		return await this.authorizeSession()
			.then(() => true)
			.catch((err) => {
				console.error(err);
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

	async handleTrackStart(track: TrackData) {
		if (!this.client?.isConnected()) {
			this.logger.debug("lastfm.handleTrackStart", track.video.videoId, "not connected");
			return;
		}
		const videoId = track.video.videoId;
		if (this.lastNowPlayingId === videoId) {
			this.logger.debug("lastfm.handleTrackStart skip duplicate", videoId);
			return;
		}
		this.lastNowPlayingId = videoId;
		this.logger.debug("isAlbum", !!track.music?.album);
		this.windowContext.sendToAllViews(IPC_EVENT_NAMES.LAST_FM_SUBMIT_STATE, "start");
		await this.client
			.updateNowPlaying({
				artist: track.video.author,
				track: track.video.title,
				duration: track.meta.duration,
				...(track.music?.album && { album: track.music.album }),
			})
			.then(stringifyJson)
			.then((d) => this.logger.debug(d))
			.then(() => {
				this.windowContext.sendToAllViews(IPC_EVENT_NAMES.LAST_FM_SUBMIT_STATE, true);
			})
			.catch((err) => {
				this.logger.error(err);
				this.windowContext.sendToAllViews(IPC_EVENT_NAMES.LAST_FM_SUBMIT_STATE, false);
			});
	}

	async handleTrackChange(track: TrackData) {
		if (!this.client?.isConnected()) {
			this.logger.debug("lastfm.handleTrackChange", track.video.videoId, "not connected");
			return;
		}
		const videoId = track.video.videoId;
		if (this.lastScrobbledId === videoId) {
			this.logger.debug("lastfm.handleTrackChange skip duplicate", videoId);
			return;
		}
		this.lastScrobbledId = videoId;
		this.logger.debug("isAlbum", !!track.music?.album);
		this.windowContext.sendToAllViews(IPC_EVENT_NAMES.LAST_FM_SUBMIT_STATE, "change");
		await this.client
			.scrobble({
				artist: track.video.author,
				track: track.video.title,
				timestamp: track.meta.startedAt,
				duration: track.meta.duration,
				...(track.music?.album && { album: track.music.album }),
			})
			.then(stringifyJson)
			.then((d) => this.logger.debug(d))
			.then(() => {
				this.windowContext.sendToAllViews(IPC_EVENT_NAMES.LAST_FM_SUBMIT_STATE, true);
			})
			.catch((err) => {
				this.logger.error(err);
				this.windowContext.sendToAllViews(IPC_EVENT_NAMES.LAST_FM_SUBMIT_STATE, false);
			});
	}
}
