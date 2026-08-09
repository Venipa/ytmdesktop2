import { AfterInit, BaseProvider } from "@main/core/baseProvider";
import { defaultUrl } from "@main/infra/devUtils";
import { emitAppToast, friendlyQueueAddError } from "@main/lib/appToast";
import { YtmClient } from "@main/ytm/ytm-client";
import { type YtmdParsed, YtmdLink } from "@shared/protocol/ytmdProtocol";
import { App } from "electron";

export default class NavigationProvider extends BaseProvider implements AfterInit {
	private lastNavigationIsSameOrigin = true;
	private guardsWired = false;

	constructor(private app: App) {
		super("navigation");
	}

	async AfterInit() {
		if (this.guardsWired) return;
		const view = this.views.youtubeView;
		if (!view || view.webContents.isDestroyed()) return;
		this.guardsWired = true;
		view.webContents.on("did-navigate-in-page", async (_ev, url) => {
			await this.handleNavigationGuards(url);
		});
		view.webContents.on("did-navigate", async (_ev, url) => {
			await this.handleNavigationGuards(url);
		});
	}

	private isKoreanUser() {
		try {
			return this.app.getLocale().toLowerCase().startsWith("ko");
		} catch {
			return false;
		}
	}

	private isMusicPremiumUrl(url: string) {
		try {
			const parsedUrl = new URL(url);
			const normalizedPath = parsedUrl.pathname.replace(/\/+$/, "").toLowerCase();
			return ["youtube.com", "www.youtube.com"].includes(parsedUrl.hostname.toLowerCase()) && normalizedPath === "/musicpremium";
		} catch {
			return false;
		}
	}

	private async handleKoreanMusicPremiumGuard(url: string): Promise<boolean> {
		if (!this.isKoreanUser() || !this.isMusicPremiumUrl(url)) return false;
		this.logger.info(`korean musicpremium guard: redirecting to ${defaultUrl}`);
		await this.views.youtubeView.webContents.loadURL(defaultUrl);
		return true;
	}

	private handleSameOriginNavigation(url: string): void {
		const isHome = !!url.match(defaultUrl);
		this.logger.debug(`isHome :: ${isHome}, ${url}`);
		if (isHome !== this.lastNavigationIsSameOrigin) {
			this.lastNavigationIsSameOrigin = isHome;
			this.windowContext.sendToAllViews("nav.same-origin", isHome);
			if (isHome) this.handlePreloadOnWindowNav();
		}
	}

	private async handleNavigationGuards(url: string): Promise<void> {
		const hasHandledKoreanMusicPremium = await this.handleKoreanMusicPremiumGuard(url);
		if (hasHandledKoreanMusicPremium) return;
		this.handleSameOriginNavigation(url);
	}

	private async isYTMLoaded() {
		if (this.windowContext.main.webContents.isLoading()) return null;
		const view = this.views.youtubeView;
		if (!view || view.webContents.isDestroyed() || view.webContents.isLoading()) return null;
		try {
			// Fast page-agent probe. Do NOT use YtmClient.isReady here:
			// IPC timeout (3s+) returning false used to call main.reload() and stall boot.
			return !!(await view.webContents.executeJavaScript(
				`(typeof window.isYTMLoaded === "function" && !!window.isYTMLoaded())`,
			));
		} catch {
			return false;
		}
	}
	private _isPreloading = false;
	private async handlePreloadOnWindowNav() {
		const isLoaded = await this.isYTMLoaded();
		if (isLoaded === null) return;
		if (this._isPreloading) {
			if (isLoaded) this._isPreloading = false;
			return;
		}
		if (!isLoaded) {
			this._isPreloading = true;
			this.logger.warn("ytm preload missing on home nav — reloading youtube view only");
			// Reload youtube view, not the whole main window (avoids full app rebootstrap).
			try {
				this.views.youtubeView.webContents.reload();
			} catch (err) {
				this.logger.error("youtube reload failed", err);
				this._isPreloading = false;
			}
		}
	}
	async goHome() {
		await this.views.youtubeView.webContents.loadURL(defaultUrl);
	}

	/**
	 * Resolve `ytmd://` / https music|youtube|youtu.be URL and act immediately (no ask dialog).
	 * Watch → play; playlist → open (or play when `/play`); channel → open.
	 */
	async openUrl(url: string): Promise<{ ok: true; link: YtmdParsed }> {
		const link = YtmdLink.resolve(url);
		if (!link) {
			throw new Error("unsupported or invalid url");
		}
		if (link.type === "watch") {
			await this.openWatch(link.videoId, link.playlistId);
		} else if (link.type === "playlist") {
			await this.openPlaylist(link.playlistId, link.play);
		} else {
			await this.openChannel({ channelId: link.channelId, handle: link.handle });
		}
		return { ok: true as const, link };
	}

	/**
	 * Open a song via YTM in-page `yt-navigate` (upstream remoteControl navigate).
	 * Drops radio/mix playlist ids (`RD…`) — they stall with "Radio is starting…".
	 */
	async openWatch(videoId: string, playlistId?: string) {
		const list = playlistId?.trim();
		const safeList = list && YtmdLink.isWatchPlaylistContext(list) ? list : undefined;
		if (list && !safeList) {
			this.logger.debug("openWatch: stripping radio playlistId", list);
		}
		await this.sendNavigate({
			videoId,
			...(safeList ? { playlistId: safeList } : {}),
		});
	}

	/** Open playlist page, or start playing when `play` is true. */
	async openPlaylist(playlistId: string, play = false) {
		await this.sendNavigate({ playlistId, play });
	}

	/** Open artist/channel by UC id and/or @handle (plugin `navigate` only). */
	async openChannel(opts: { channelId?: string; handle?: string }) {
		const channelId = opts.channelId?.trim();
		const handle = opts.handle?.trim().replace(/^@+/, "");
		if (!channelId && !handle) {
			throw new Error("channelId or handle required");
		}
		await this.sendNavigate({
			...(channelId ? { channelId } : {}),
			...(handle ? { handle } : {}),
		});
	}

	/** Append video **or** playlist to queue (never both — YTM rejects combined targets). */
	async queueAdd(videoId?: string, playlistId?: string) {
		this.requireYoutubeView("queueAdd");
		const vid = videoId?.trim() || undefined;
		const list = playlistId?.trim() || undefined;
		if (vid && list) {
			this.logger.debug("queueAdd: dropping playlistId when videoId present");
		}
		const target = vid ? { videoId: vid } : list ? { playlistId: list } : null;
		if (!target) {
			throw new Error("videoId or playlistId required");
		}
		await this.requireYtmReady("queueAdd");
		try {
			await YtmClient.cmdTimed("api", "queue_add", 15_000, target);
			emitAppToast(this.windowContext, { type: "success", message: "Added to queue" });
		} catch (err) {
			emitAppToast(this.windowContext, { type: "error", message: friendlyQueueAddError(err) });
			throw err;
		}
	}

	/** Current YTM queue snapshot (ids/titles when store hooked). */
	async queueList(): Promise<{ items: { index: number; videoId?: string; title?: string }[]; count: number; storeHooked?: boolean }> {
		this.requireYoutubeView("queueList");
		await this.requireYtmReady("queueList");
		return await YtmClient.cmdTimed<{ items: { index: number; videoId?: string; title?: string }[]; count: number; storeHooked?: boolean }>(
			"api",
			"queue_list",
			10_000,
		);
	}

	/** Clear upcoming queue (store CLEAR, else playerApi.clearQueue). */
	async queueClear(): Promise<{ ok: true }> {
		this.requireYoutubeView("queueClear");
		await this.requireYtmReady("queueClear");
		await YtmClient.cmdTimed("api", "queue_clear", 10_000);
		return { ok: true as const };
	}

	private requireYoutubeView(op: string) {
		const view = this.views.youtubeView;
		if (!view || view.webContents.isDestroyed()) {
			throw new Error(`${op} failed — youtube view missing`);
		}
		return view;
	}

	private async requireYtmReady(op: string) {
		if (!(await this.isYtmReady())) {
			throw new Error(`${op} failed — ytm not ready`);
		}
	}

	private async sendNavigate(payload: Record<string, unknown>) {
		this.requireYoutubeView("navigate");
		await this.requireYtmReady("navigate");
		await YtmClient.cmdTimed("api", "navigate", 15_000, payload);
	}

	toggleDevTools() {
		if (!this.views.youtubeView.webContents.isDevToolsOpened()) this.views.youtubeView.webContents.openDevTools({ mode: "detach" });
		else this.views.youtubeView.webContents.closeDevTools();
	}

	private async __onHomeAction() {
		await this.goHome();
	}
	private async __onDevAction() {
		this.toggleDevTools();
	}
}
