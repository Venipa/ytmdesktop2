import { join } from "path";
import translations from "@translations/index";
import { BrowserWindow, BrowserWindowConstructorOptions, WebContentsView, WebContentsViewConstructorOptions, WebPreferences, ipcMain } from "electron";
import appIconPath from "~/build/favicon.ico?asset";
import { defaultUrl, isDevelopment, isProduction } from "./devUtils";
import { LockSizeOptions, loadUrlOfWebContents, lockSizeToParent } from "./webContentUtils";

type CreateApiViewOptions = { lockSize: LockSizeOptions } & Pick<WebPreferences, "transparent">;
export const createApiView = async <T extends WebContentsView>(path: string, postFunc?: (ctx: T) => Promise<void> | void, options?: CreateApiViewOptions): Promise<T> => {
	const view = new WebContentsView({
		webPreferences: {
			nodeIntegration: true,
			sandbox: false,
			contextIsolation: true,
			webSecurity: isProduction,
			allowRunningInsecureContent: !isProduction,
			preload: join(__dirname, "../preload/api.js"),
			transparent: options?.transparent,
		},
	}) as T;
	await loadUrlOfWebContents(view.webContents, path);
	if (postFunc) await Promise.resolve(postFunc(view));
	const wnd = BrowserWindow.fromWebContents(view.webContents);
	if (wnd) lockSizeToParent(wnd, options?.lockSize)(view);
	return view;
};
export const createView = async <T extends WebContentsView>(
	preload: string,
	postFunc?: (ctx: T) => Promise<void> | void,
	options: WebContentsViewConstructorOptions["webPreferences"] = {},
): Promise<T> => {
	const view = new WebContentsView({
		webPreferences: {
			disableHtmlFullscreenWindowResize: true,
			nodeIntegration: true,
			sandbox: false,
			webSecurity: isProduction,
			allowRunningInsecureContent: !isProduction,
			contextIsolation: true,
			...options,
			preload,
		},
	}) as T;
	if (postFunc) await Promise.resolve(postFunc(view));
	const wnd = BrowserWindow.fromWebContents(view.webContents);
	if (wnd) lockSizeToParent(wnd)(view);
	return view;
};
export const createPopup = async (options?: BrowserWindowConstructorOptions) => {
	const wnd = new BrowserWindow({
		minHeight: 400,
		minWidth: 400,
		...(options ? options : {}),
		webPreferences: {
			disableHtmlFullscreenWindowResize: true,
			nodeIntegration: true,
			sandbox: false,
			webSecurity: isProduction,
			contextIsolation: false, // window object is required to be rewritten for tracking current track
			...(options?.webPreferences ? options.webPreferences : {}),
		},
	});

	const lockSize = lockSizeToParent(wnd);
	return { popup: wnd, lockSize };
};
export const GoogleUA = {
	darwin: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.152 Safari/537.36",
	win32: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.152 Safari/537.36",
	linux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.152 Safari/537.36",
	unknown: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:98.0) Gecko/20100101 Firefox/98.0",
};
export const getCurrentPlatformUserAgent = () => {
	const platform = process.platform;
	const userAgent = GoogleUA[platform as keyof typeof GoogleUA];
	return userAgent ?? GoogleUA.unknown;
};
export const googleLoginPopup = async (authUrl: string, parent?: Electron.BrowserWindow) => {
	const webPreferences: Electron.WebPreferences = {
		nodeIntegration: false,
		nodeIntegrationInSubFrames: false,
		nodeIntegrationInWorker: false,
		webSecurity: isProduction,
		sandbox: false,
		contextIsolation: true,
		allowRunningInsecureContent: false,
		preload: join(__dirname, "../preload/login.js"),
	};
	const { lockSize, popup } = await createPopup({
		icon: appIconPath,
		title: translations.appName,
		height: 580,
		width: 800,
		resizable: false,
		maximizable: false,
		frame: false,
		fullscreenable: false,
		minimizable: false,
		alwaysOnTop: true,
		autoHideMenuBar: true,
		webPreferences,
		...((parent && { parent, modal: true }) || {}),
	});
	popup.setMenu(null);
	const USER_AGENT = getCurrentPlatformUserAgent();
	const secureBrowserHeaders = `User-Agent: ${USER_AGENT}`;
	const noticeView = await createApiView("youtube/login-notice");
	popup.contentView.addChildView(noticeView);
	const [width, height] = popup.getContentSize();
	const noticeHeight = 120;
	noticeView.setBounds({ height: noticeHeight, width, x: 0, y: 0 });
	const loginView = new WebContentsView({
		webPreferences,
	});
	popup.contentView.addChildView(loginView, 0);
	loginView.setBounds({ height: height - noticeHeight, width, x: 0, y: noticeHeight });
	loginView.webContents.setUserAgent(getCurrentPlatformUserAgent());
	await loginView.webContents.loadURL(authUrl, {
		userAgent: USER_AGENT,
		httpReferrer: defaultUrl,
	});
	loginView.webContents.setUserAgent(USER_AGENT);
	loginView.webContents.session.webRequest.onBeforeSendHeaders(
		{
			urls: ["https://accounts.google.com/*"],
		},
		(details, callback) => {
			secureBrowserHeaders.split("\n").forEach((header) => {
				const [key, value] = [header.slice(0, header.indexOf(":"))?.trimStart?.(), header.slice(header.indexOf(":") + 1)?.trimStart?.()];
				console.log("GOOGLE HEADERS: ", key, value);
				if (key) details.requestHeaders[key.trimStart()] = value.trimStart();
			});
			callback(details);
		},
	);
	if (isDevelopment) {
		loginView.webContents.openDevTools({ mode: "detach" });
		noticeView.webContents.openDevTools({ mode: "detach" });
	}

	let timeoutHandler: NodeJS.Timeout; // timeout after 10 minutes
	const clearGC = () => {
		timeoutHandler && clearTimeout(timeoutHandler);
	};
	ipcMain.once("subwindow.close/loginView", () => {
		popup.close();
		clearGC();
	});
	return await new Promise<boolean>((resolve, reject) => {
		timeoutHandler = setTimeout(
			() => {
				reject();
			},
			10 * 60 * 1000,
		);
		let isAuthenticated = false;
		popup.on("close", () => {
			resolve(isAuthenticated);
			clearGC();
		});
		loginView.webContents.on("ipc-message", (ev, eventName) => {
			console.log("login event", eventName);
			if (eventName === "g-login-success") {
				isAuthenticated = true;
				popup.close();
			}
		});
	});
};
