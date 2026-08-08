import { platform } from "@electron-toolkit/utils";
import { ServiceCollection } from "@main/core/providerCollection";
import { isDevelopment } from "@main/infra/devUtils";
import { serverMain } from "@main/ipc/serverEvents";
import { runLifecycle } from "@main/lifecycle";
import { BrowserWindowViews } from "@main/windows/mappedWindow";
import { app } from "electron";
import { setTrayState } from "./trayState";

let isQuitRequested = false;
let isForceQuitRequested = false;
let isCleanupRunning = false;
let cleanupPromise: Promise<void> | null = null;
let services: ServiceCollection | null = null;

async function ensureCleanup() {
	if (!cleanupPromise) {
		cleanupPromise = (async () => {
			services?.getTypedProvider("settings")?.saveToDrive();
			if (services) {
				await services.exec("OnDestroy");
				await runLifecycle("destroy");
			}
		})().catch((error) => {
			console.error("Error while running app cleanup during quit", error);
		});
	}
	return cleanupPromise;
}

/** Persist settings, destroy providers, then relaunch. Skips tray minimize. */
export async function requestAppRelaunch() {
	if (isCleanupRunning || isQuitRequested) return;
	isCleanupRunning = true;
	isForceQuitRequested = true;
	await ensureCleanup();
	isQuitRequested = true;
	app.relaunch();
	app.exit(0);
}

export function attachQuitHandler(mainWindow: BrowserWindowViews<any, any>, serviceCollection: ServiceCollection) {
	services = serviceCollection;
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

	// Use serverMain (not raw ipcMain) so main-side emit + renderer IPC share one path
	serverMain.on("app.quit", (_ev, forceQuit: boolean = false) => {
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
