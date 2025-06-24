import { onWindowLoad } from "@main/utils/windowUtils";
import logger from "@shared/utils/Logger";
import { waitMs } from "@shared/utils/promises";
import { BrowserWindow, IpcMainEvent, app, protocol } from "electron";
import { isDevelopment } from "./utils/devUtils";
import { initializeCustomElectronEnvironment } from "./utils/electron";
import { serverMain } from "./utils/serverEvents";
import { createEventCollection, createServiceCollection } from "./utils/serviceCollection";
import { WindowManager } from "./utils/windowManager";

initializeCustomElectronEnvironment();
const log = logger.child("main");

const runApp = async function () {
	const serviceCollection = await createServiceCollection(app),
		eventCollection = await createEventCollection(app, serviceCollection.getItems());

	log.debug(`Loaded Providers: ${serviceCollection.getProviderNames().join(", ")}`);
	log.debug(`Loaded Events: ${eventCollection.getProviderNames().join(", ")}`);

	try {
		await serviceCollection.exec("BeforeStart");
		await eventCollection.prepare();
	} catch (ex) {
		log.error(ex); // before start can be ignored, experimental
	}

	protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { secure: true, standard: true } }]);
	const brickGoogleUA = {
		darwin: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:139.0) Gecko/20100101 Firefox/139.0",
		win32: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:139.0) Gecko/20100101 Firefox/139.0",
		linux: "Mozilla/5.0 (X11; Linux x86_64; rv:139.0) Gecko/20100101 Firefox/139.0",
	};
	const currentUserAgent = brickGoogleUA[process.platform] ?? brickGoogleUA.win32;
	const windowManager = new WindowManager(currentUserAgent);
	let mainWindow: ReturnType<typeof windowManager.createRootWindow> extends Promise<infer T> ? T : never;

	const reactivate = async () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			mainWindow = await windowManager.createRootWindow();
			await waitMs(); // next tick
			mainWindow.main.show();

			if (serviceCollection) {
				serviceCollection.registerWindows(mainWindow);
				await serviceCollection.exec("AfterInit");
			}
		}
	};

	app.on("window-all-closed", () => {
		if (process.platform !== "darwin") {
			serverMain.emit("app.quit", null, true);
		}
	});

	app.on("activate", reactivate);
	app.on("ready", async () => {
		await waitMs(); // next tick
		mainWindow = await windowManager.createRootWindow();
		serviceCollection.registerWindows(mainWindow);

		await waitMs(); // next tick
		await serviceCollection.exec("OnInit");

		const startupService = serviceCollection.getTypedProvider("startup");
		log.debug({ isStartupContext: startupService.isStartupContext });

		if (startupService.isStartupContext ? !startupService.isEnabled || !startupService.isInitialMinimized : !startupService.isMinimizedArg) {
			mainWindow.main.show();
		}
		await onWindowLoad(mainWindow.main, () => serviceCollection.exec("AfterInit"), { once: true });
		mainWindow.main.webContents.on("did-finish-load", () => serviceCollection.exec("AfterInit")); // if reloaded run afterInit again
	});

	// Window control events
	serverMain.on("app.minimize", (ev) => {
		const window = BrowserWindow.fromWebContents(ev.sender);
		if (window && window.isMinimizable()) window.minimize();
	});

	serverMain.on("app.maximize", (ev) => {
		const window = BrowserWindow.fromWebContents(ev.sender);
		if (window && window.isMaximizable()) window.isMaximized() ? window.unmaximize() : window.maximize();
	});

	serverMain.on("app.goback", () => {
		const { youtubeView } = mainWindow.views ?? {};
		if (!youtubeView || youtubeView.webContents.isDestroyed() || !youtubeView.webContents.navigationHistory.canGoBack()) return;
		youtubeView.webContents.navigationHistory.goBack();
	});

	let forcedQuit = false;
	serverMain.on("app.quit", (ev: IpcMainEvent, forceQuit: boolean) => {
		forcedQuit = !!forceQuit;
		app.quit();
	});

	app.on("before-quit", (ev) => {
		if (forcedQuit || serviceCollection.getTypedProvider("update").updateQueuedForInstall) return;

		const settings = serviceCollection.getTypedProvider("settings");
		if (settings.get("app.minimizeTrayOverride")) {
			serverMain.emit("app.trayState", null, "hidden");
			ev.preventDefault(); // prevent quit - minimize to tray
		} else {
			serviceCollection.getTypedProvider("settings")?.saveToDrive();
		}
	});

	serverMain.on("app.restore", () => {
		if (!mainWindow.main.isVisible()) {
			serverMain.emit("app.trayState", null, "visible");
		}
	});

	serverMain.on("app.trayState", (ev: IpcMainEvent, state: string) => {
		if (state === "visible" && !mainWindow.main.isVisible()) {
			mainWindow.main.show();
			mainWindow.main.setSkipTaskbar(false);
		} else if (state === "hidden" && mainWindow.main.isVisible()) {
			mainWindow.main.hide();
			mainWindow.main.setSkipTaskbar(true);
		}
	});

	// Exit cleanly on request from parent process in development mode.
	if (isDevelopment) {
		if (process.platform === "win32") {
			process.on("message", (data) => {
				if (data === "graceful-exit") {
					serviceCollection.exec("OnDestroy").then(() => serverMain.emit("app.quit", true));
				}
			});
		} else {
			process.on("SIGTERM", () => {
				serviceCollection.exec("OnDestroy").then(() => serverMain.emit("app.quit", true));
			});
		}
	}
};

runApp();
