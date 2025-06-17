import { join } from "path";
import { logger } from "@shared/utils/console";
import translations from "@translations/index";
import { BrowserWindow, BrowserWindowConstructorOptions, WebContentsView } from "electron";
import { debounce } from "lodash-es";
import appIconPath from "~/build/favicon.ico?asset";
import { defaultUrl, isDevelopment } from "./devUtils";
import { createWindowContext } from "./mappedWindow";
import { serverMain } from "./serverEvents";
import { createApiView, createView, googleLoginPopup } from "./view";
import { callWindowListeners, pushWindowStates } from "./webContentUtils";
import { wrapWindowHandler } from "./windowUtils";

function isPreventedNavOrRedirect(url: URL): boolean {
	return (
		/^(?!consent\.youtube\.com|accounts\.youtube\.com|music\.youtube\.com|accounts\.google\.\w+)$/.test(url.hostname) &&
		!/^(www\.youtube\.com|youtube\.com)\/(premium|musicpremium)$/i.test(url.hostname + url.pathname) &&
		!url.hostname.match(/^accounts\.google\.(\w+)$/)
	);
}

const GOOGLE_LOGIN_URL =
	"https://accounts.google.com/ServiceLogin?" +
	new URLSearchParams({
		ltmpl: "music",
		service: "youtube",
		continue: "https://www.youtube.com/signin?action_handle_signin=true&app=desktop&next=https://music.youtube.com/",
	}).toString();
export interface WindowViews extends Record<string, WebContentsView> {
	youtubeView: WebContentsView;
	toolbarView: WebContentsView;
}

export class WindowManager {
	private mainWindow: BrowserWindow | null = null;
	private views: WindowViews | null = null;
	private loadingView: WebContentsView | null = null;
	private isGoogleLoginProcessing = false;

	constructor(private readonly userAgent: string) {}

	async createRootWindow(options?: BrowserWindowConstructorOptions) {
		const winSize = {
			width: 1500,
			height: 800,
		};

		this.mainWindow = new BrowserWindow({
			...winSize,
			minWidth: 800,
			minHeight: 480,
			autoHideMenuBar: true,
			icon: appIconPath,
			backgroundColor: "#030404",
			center: true,
			closable: true,
			skipTaskbar: false,
			resizable: true,
			frame: false,
			title: translations.appName,
			darkTheme: true,
			titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
			maximizable: true,
			show: false,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: true,
				sandbox: false,
				webSecurity: isDevelopment,
				allowRunningInsecureContent: !isDevelopment,
				backgroundThrottling: false,
				...(options?.webPreferences || {}),
			},
			...(options || {}),
		});

		this.setupWindowUserAgent();
		await this.setupViews();
		this.setupWindowEvents();
		await this.initializeWindowState(winSize);

		return createWindowContext({
			main: this.mainWindow,
			views: this.views!,
		});
	}

	private setupWindowUserAgent() {
		if (!this.mainWindow) return;

		this.mainWindow.webContents.setUserAgent(this.userAgent);
		this.mainWindow.webContents.session.setUserAgent(this.userAgent);

		this.mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
			{
				urls: ["https://accounts.google.com/*"],
			},
			(details, callback) => {
				details.requestHeaders["User-Agent"] = this.userAgent;
				callback(details);
			},
		);
	}

	private async setupViews() {
		if (!this.mainWindow) return;

		this.loadingView = await this.createLoadingView();
		this.views = {
			youtubeView: await this.createYoutubeView(),
			toolbarView: await this.createToolbarView(),
		};

		this.setupViewEvents();
	}

	private async createLoadingView() {
		const view = await createApiView("/youtube/loading", (view) => {
			if (!this.mainWindow) return;

			this.mainWindow.contentView.addChildView(view);
			if (isDevelopment) view.webContents.openDevTools({ mode: "detach" });

			const [width, height] = this.mainWindow.getSize();
			view.setBounds({
				x: 0,
				y: 0,
				width,
				height,
			});
		});
		return view;
	}

	private async createYoutubeView() {
		return await createView(
			join(__dirname, "../preload/youtube.js"),
			(view) => {
				if (!this.mainWindow) return;

				this.mainWindow.contentView.addChildView(view);
				const [width, height] = this.mainWindow.getSize();
				view.setBounds({
					y: 40,
					x: 0,
					height: height - 40,
					width,
				});

				this.setupYoutubeViewEvents(view);
			},
			{
				sandbox: false,
				contextIsolation: false,
			},
		);
	}

	private async createToolbarView() {
		return await createApiView(
			"/youtube/toolbar",
			(view) => {
				if (!this.mainWindow) return;

				this.mainWindow.contentView.addChildView(view);
				this.mainWindow.contentView.addChildView(this.loadingView!);
				const [width, height] = this.mainWindow.getSize();
				view.setBounds({
					height: 40,
					width,
					x: 0,
					y: 0,
				});
				if (isDevelopment) view.webContents.openDevTools({ mode: "detach" });
			},
			{ lockSize: { resize: "width" }, transparent: true },
		);
	}

	private setupYoutubeViewEvents(view: WebContentsView) {
		let lastLocation: string;

		view.webContents.on("did-navigate", (ev, location) => {
			lastLocation = location;
		});
		// Prevent navigation if google is processing login
		view.webContents.on("will-navigate", (ev, location) => {
			if (this.isGoogleLoginProcessing) {
				ev.preventDefault();
				return;
			}

			if (location?.match(/^https?\:\/\/(accounts)?.google.(\w+)/)) {
				ev.preventDefault();
				this.handleGoogleLogin(location, view);
			}
		});

		// Handle YouTube Music View navigation, restart internal app service cycle if needed
		view.webContents.on("will-navigate", (ev, location) => {
			if (!lastLocation?.match(defaultUrl) && !!location?.match(defaultUrl)) {
				serverMain.emit("app.loadStart");
			} else {
				pushWindowStates(view.webContents.id);
			}
		});
		// Handle YouTube Music View redirects that may require premium subscription
		view.webContents.on("will-redirect", (event) => {
			const url = new URL(event.url);
			if (isPreventedNavOrRedirect(url)) {
				event.preventDefault();
				logger.info(`Handling YouTube Music View navigation: ${event.url}`);
			}

			if (/^(?:www\.)?youtube\.com\/(?:premium|musicpremium)$/i.test(url.hostname + url.pathname)) {
				// Redirecting to Google sign-in page for YouTube Music access, maybe require premium subscription
				this.handleGoogleLogin(GOOGLE_LOGIN_URL, view);
			}
		});
		view.webContents.on("page-title-updated", (ev, title) => view.webContents.emit("window-title-updated", title));
	}

	private async handleGoogleLogin(location: string, view: WebContentsView) {
		this.isGoogleLoginProcessing = true;
		try {
			const isAuthenticated = await googleLoginPopup(location, this.mainWindow!);
			if (isAuthenticated) {
				view.webContents.reload();
				await new Promise<void>((resolve) => view.webContents.once("did-finish-load", () => resolve()));
			}
		} finally {
			this.isGoogleLoginProcessing = false;
		}
	}

	private setupViewEvents() {
		serverMain.on("app.loadEnd", () => {
			if (!this.mainWindow || !this.loadingView || !this.views) return;
			this.mainWindow.contentView.removeChildView(this.loadingView);
			this.mainWindow.contentView.addChildView(this.views.toolbarView);
		});

		serverMain.on(
			"app.loadStart",
			debounce(() => {
				if (!this.mainWindow || !this.loadingView || !this.views) return;
				if (!this.mainWindow.contentView.children?.find((x) => this.loadingView?.webContents && x === this.loadingView)) {
					this.mainWindow.contentView.addChildView(this.loadingView);
				}
			}, 100),
		);
	}

	private setupWindowEvents() {
		if (!this.mainWindow || !this.views) return;

		let fromMaximized = false;

		this.mainWindow.on("maximize", () => {
			fromMaximized = true;
			this.updateViewBounds();
		});
		this.mainWindow.on("unmaximize", () => {
			fromMaximized = false;
			this.updateViewBounds();
		});
		this.mainWindow.on(
			"resize",
			debounce(() => {
				this.updateViewBounds();
			}, 100),
		);
	}

	private updateViewBounds() {
		if (!this.mainWindow || !this.views) return;

		const [winWidth, winHeight] = this.mainWindow.getSize();
		const youtubeBounds = this.views.youtubeView.getBounds();
		const toolbarBounds = this.views.toolbarView.getBounds();

		this.views.toolbarView.setBounds({
			...toolbarBounds,
			width: winWidth,
		});

		this.views.youtubeView.setBounds({
			...youtubeBounds,
			width: winWidth,
			height: winHeight - toolbarBounds.height,
		});
	}

	private async initializeWindowState(winSize: { width: number; height: number }) {
		if (!this.mainWindow || !this.views) return;

		const { state } = await wrapWindowHandler(this.mainWindow, "root", { ...winSize });

		if (state?.maximized) {
			this.mainWindow.maximize();
		} else {
			this.mainWindow.setBounds({ ...state });
		}

		callWindowListeners(this.mainWindow, "will-resize", state);
		serverMain.emit("app.loadStart");

		await this.views.youtubeView.webContents.loadURL(defaultUrl).then(() => {
			if (isDevelopment) {
				this.views!.youtubeView.webContents.openDevTools({ mode: "detach" });
			}

			if (process.platform === "darwin") {
				const bounds = this.mainWindow!.getBounds();
				this.mainWindow!.setBounds({
					width: bounds.width + 1,
				});
				this.mainWindow!.setBounds({
					width: bounds.width - 1,
				});
			}
		});
	}

	getWindow() {
		return this.mainWindow;
	}

	getViews() {
		return this.views;
	}
}
