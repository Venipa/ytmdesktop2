import { join } from "path";
import translations from "@translations/index";
import { BrowserWindow, BrowserWindowConstructorOptions, WebContentsView, WebContentsViewConstructorOptions, WebPreferences, ipcMain, shell } from "electron";
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
	await loginView.webContents.loadURL(authUrl, {
		httpReferrer: defaultUrl,
	});
	loginView.webContents.setWindowOpenHandler(({ url }) => {
		if (!url.startsWith("http")) {
			return { action: "deny" };
		}
		if (/^https?\:\/\/([a-zA-Z0-9]+)?\.google\.([a-z]+)/.test(url)) {
			shell.openExternal(url);
			return { action: "deny" };
		}
		return { action: "allow" };
	});
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
