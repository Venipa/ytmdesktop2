import { IpcMainEvent } from "electron";
import { BrowserWindowViews } from "../mappedWindow";
import { serverMain } from "../serverEvents";
let mainWindowRef: BrowserWindowViews<any, any> | null = null;
export function attachTrayState<T extends BrowserWindowViews<any, any>>(mainWindow: T) {
	if (mainWindowRef) throw new Error("Tray state handler already attached to a main window");
	mainWindowRef = mainWindow;
	serverMain.on("app.restore", () => {
		if (!mainWindow.main.isVisible()) {
			serverMain.emit("app.trayState", null, "visible");
		}
	});

	serverMain.on("app.trayState", (ev: IpcMainEvent, state: string) => {
		if (state === "visible" && !mainWindow.main.isVisible()) {
			setTrayState("visible");
		} else if (state === "hidden" && mainWindow.main.isVisible()) {
			setTrayState("hidden");
		}
	});
}

export function setTrayState(state: "visible" | "hidden") {
	if (!mainWindowRef) return;
	if (state === "visible" && !mainWindowRef.main.isVisible()) {
		mainWindowRef.main.show();
		mainWindowRef.main.setSkipTaskbar(false);
	} else if (state === "hidden" && mainWindowRef.main.isVisible()) {
		mainWindowRef.main.hide();
		mainWindowRef.main.setSkipTaskbar(true);
	}
}
