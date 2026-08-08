import { AfterInit, BaseProvider } from "@main/core/baseProvider";
import { defaultUrl } from "@main/infra/devUtils";
import { createSendHandler } from "@main/ipc/ipc";
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

	private isYTMLoaded() {
		if (this.windowContext.main.webContents.isLoading()) return null;
		return this.views.youtubeView.webContents
			.executeJavaScript(`typeof window.isYTMLoaded === "function" && !!window.isYTMLoaded()`)
			.then((x) => !!x)
			.catch(() => false);
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
			this.windowContext.main.reload();
		}
	}
	async goHome() {
		await this.views.youtubeView.webContents.loadURL(defaultUrl);
	}

	/**
	 * Open a song via YTM in-page `yt-navigate` (upstream remoteControl navigate).
	 */
	async openWatch(videoId: string, playlistId?: string) {
		const view = this.views.youtubeView;
		if (!view || view.webContents.isDestroyed()) {
			this.logger.warn("openWatch skipped — youtube view missing");
			return;
		}
		if (!(await this.isYtmReady())) {
			this.logger.warn("openWatch skipped — ytm not ready", videoId);
			return;
		}
		await createSendHandler(view, "plugins:api:cmd:navigate", { timeout: 15000 })({
			videoId,
			...(playlistId ? { playlistId } : {}),
		});
	}

	/** Append to current YTM queue (upstream companion queueAdd). */
	async queueAdd(videoId: string, playlistId?: string) {
		const view = this.views.youtubeView;
		if (!view || view.webContents.isDestroyed()) {
			this.logger.warn("queueAdd skipped — youtube view missing");
			return;
		}
		if (!(await this.isYtmReady())) {
			this.logger.warn("queueAdd skipped — ytm not ready", videoId);
			return;
		}
		await createSendHandler(view, "plugins:api:cmd:queue_add", { timeout: 15000 })({
			videoId,
			...(playlistId ? { playlistId } : {}),
		});
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
