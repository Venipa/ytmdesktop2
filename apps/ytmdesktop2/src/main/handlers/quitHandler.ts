import { platform } from "@electron-toolkit/utils";
import { ServiceCollection } from "@main/core/providerCollection";
import { isDevelopment } from "@main/infra/devUtils";
import { serverMain } from "@main/ipc/serverEvents";
import { runLifecycle } from "@main/lifecycle";
import { BrowserWindowViews } from "@main/windows/mappedWindow";
import { logger } from "@shared/utils/console";
import { app } from "electron";
import { autoUpdater } from "electron-updater";
import { isAppQuitting, markAppQuitting, shouldCancelWindowClose } from "./quitPolicy";
import { setTrayState } from "./trayState";

let cleanupPromise: Promise<void> | null = null;
let services: ServiceCollection | null = null;

export { isAppQuitting } from "./quitPolicy";

async function ensureCleanup() {
	if (!cleanupPromise) {
		cleanupPromise = (async () => {
			services?.getTypedProvider("settings")?.saveToDrive();
			if (services) {
				await services.exec("OnDestroy");
				await runLifecycle("destroy");
			}
		})().catch((error) => {
			logger.error("Error while running app cleanup during quit", error);
		});
	}
	return cleanupPromise;
}

async function finishQuit(then: () => void) {
	if (isAppQuitting()) return;
	markAppQuitting();
	await ensureCleanup();
	then();
}

function hideToTray(mainWindow: BrowserWindowViews<any, any>) {
	setTrayState("hidden");
	if (!mainWindow.main.isDestroyed() && mainWindow.main.isVisible()) {
		mainWindow.main.hide();
		mainWindow.main.setSkipTaskbar(true);
	}
}

/** Persist settings, destroy providers, then relaunch. Skips tray minimize. */
export async function requestAppRelaunch() {
	await finishQuit(() => {
		app.relaunch();
		app.exit(0);
	});
}

/** Cleanup once, then electron-updater install. Idempotent via `quitting`. */
export async function requestQuitAndInstall() {
	await finishQuit(() => {
		autoUpdater.quitAndInstall(true, true);
	});
}

export function attachQuitHandler(mainWindow: BrowserWindowViews<any, any>, serviceCollection: ServiceCollection) {
	services = serviceCollection;
	const getSettingsProvider = () => serviceCollection.getTypedProvider("settings");
	const isMinimizeToTrayEnabled = () => !!getSettingsProvider()?.get("app.minimizeTrayOverride");
	const shouldHideToTray = (forceQuit: boolean) => isMinimizeToTrayEnabled() && !forceQuit && !isAppQuitting();

	const requestQuit = async (forceQuit: boolean = false) => {
		if (shouldHideToTray(forceQuit)) {
			hideToTray(mainWindow);
			return;
		}
		await finishQuit(() => app.quit());
	};

	// Use serverMain (not raw ipcMain) so main-side emit + renderer IPC share one path
	serverMain.on("app.quit", (_ev, forceQuit: boolean = false) => {
		void requestQuit(!!forceQuit);
	});

	mainWindow.main.on("close", (ev) => {
		if (!shouldCancelWindowClose({ quitting: isAppQuitting(), hideToTray: shouldHideToTray(false) })) return;
		if (shouldHideToTray(false)) {
			ev.preventDefault();
			hideToTray(mainWindow);
			return;
		}
		ev.preventDefault();
		void requestQuit(true);
	});

	app.on("before-quit", (ev) => {
		if (!shouldCancelWindowClose({ quitting: isAppQuitting(), hideToTray: shouldHideToTray(false) })) return;
		if (shouldHideToTray(false)) {
			ev.preventDefault();
			hideToTray(mainWindow);
			return;
		}
		ev.preventDefault();
		void requestQuit(true);
	});

	app.on("window-all-closed", () => {
		if (!platform.isMacOS || isAppQuitting()) {
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
