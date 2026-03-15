import { platform } from "@electron-toolkit/utils";
import { app, IpcMainEvent, ipcMain } from "electron";
import { isDevelopment } from "../devUtils";
import { BrowserWindowViews } from "../mappedWindow";
import { ServiceCollection } from "../providerCollection";
import { setTrayState } from "./trayState";

let isQuitRequested = false;
let isForceQuitRequested = false;
let isCleanupRunning = false;
let cleanupPromise: Promise<void> | null = null;

export function attachQuitHandler(mainWindow: BrowserWindowViews<any, any>, serviceCollection: ServiceCollection) {
	const getSettingsProvider = () => serviceCollection.getTypedProvider("settings");
	const getUpdateProvider = () => serviceCollection.getTypedProvider("update");
	const isUpdaterQuitRequested = () => !!getUpdateProvider()?.updateQueuedForInstall;
	const isMinimizeToTrayEnabled = () => !!getSettingsProvider()?.get("app.minimizeTrayOverride");

	const hideToTray = () => {
		setTrayState("hidden");
		if (mainWindow.main.isVisible()) {
			mainWindow.main.hide();
			mainWindow.main.setSkipTaskbar(true);
		}
	};

	const shouldMinimizeToTray = (forceQuit: boolean) => isMinimizeToTrayEnabled() && !forceQuit && !isUpdaterQuitRequested();

	const ensureCleanup = async () => {
		if (!cleanupPromise) {
			cleanupPromise = (async () => {
				getSettingsProvider()?.saveToDrive();
				await serviceCollection.exec("OnDestroy");
			})().catch((error) => {
				console.error("Error while running app cleanup during quit", error);
			});
		}
		return cleanupPromise;
	};

	const requestQuit = async (forceQuit: boolean = false) => {
		if (shouldMinimizeToTray(forceQuit)) {
			hideToTray();
			return;
		}
		isForceQuitRequested = isForceQuitRequested || forceQuit || isUpdaterQuitRequested();
		if (isCleanupRunning || isQuitRequested) return;
		isCleanupRunning = true;
		await ensureCleanup();
		isQuitRequested = true;
		app.quit();
	};

	ipcMain.on("app.quit", (ev: IpcMainEvent, forceQuit: boolean = false) => {
		void requestQuit(!!forceQuit);
	});

	mainWindow.main.on("close", (ev) => {
		if (isCleanupRunning && !isQuitRequested) {
			ev.preventDefault();
			return;
		}
		if (isQuitRequested || isForceQuitRequested || isUpdaterQuitRequested()) return;
		if (shouldMinimizeToTray(false)) {
			ev.preventDefault();
			hideToTray();
			return;
		}
		ev.preventDefault();
		void requestQuit(true);
	});

	app.on("before-quit", (ev) => {
		if (isQuitRequested || isForceQuitRequested || isUpdaterQuitRequested()) return;
		if (shouldMinimizeToTray(false)) {
			ev.preventDefault();
			hideToTray();
			return;
		}
		ev.preventDefault();
		void requestQuit(true);
	});

	app.on("window-all-closed", () => {
		if (!platform.isMacOS || isUpdaterQuitRequested()) {
			void requestQuit(true);
		}
	});

	// Exit cleanly on request from parent process in development mode.
	if (isDevelopment) {
		if (platform.isWindows) {
			process.on("message", (data) => {
				if (data === "graceful-exit") {
					void requestQuit(true);
				}
			});
		} else {
			process.on("SIGTERM", () => {
				void requestQuit(true);
			});
		}
	}
}
