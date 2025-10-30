import { IpcMainEvent, app } from "electron";
import { isDevelopment } from "../devUtils";
import { BrowserWindowViews } from "../mappedWindow";
import { ServiceCollection } from "../providerCollection";
import { serverMain } from "../serverEvents";
import { setTrayState } from "./trayState";

let forcedQuit = false;

export function attachQuitHandler(mainWindow: BrowserWindowViews<any, any>, serviceCollection: ServiceCollection) {
	serverMain.on("app.quit", (ev: IpcMainEvent, forceQuit: boolean) => {
		forcedQuit = !!forceQuit;
		app.quit();
	});

	app.on("before-quit", (ev) => {
		if (forcedQuit || serviceCollection.getTypedProvider("update").updateQueuedForInstall) return;

		const settings = serviceCollection.getTypedProvider("settings");
		if (settings.get("app.minimizeTrayOverride")) {
			setTrayState("hidden");
			ev.preventDefault(); // prevent quit - minimize to tray
		} else {
			serviceCollection.getTypedProvider("settings")?.saveToDrive();
		}
	});

	app.on("window-all-closed", () => {
		if (process.platform !== "darwin") {
			serverMain.emit("app.quit", null, true);
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
}
