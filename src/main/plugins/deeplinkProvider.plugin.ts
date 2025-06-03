import { AfterInit, BaseProvider, BeforeStart } from "@main/utils/baseProvider";
import IPC_EVENT_NAMES from "@main/utils/eventNames";
import { BrowserWindow, app } from "electron";

const DEEPLINK_PREFIX = "ytmd://";
const PROTOCOL = "ytmd";

export default class DeeplinkProvider extends BaseProvider implements BeforeStart, AfterInit {
	constructor() {
		super("deeplink");
		// Register the protocol
		if (process.defaultApp) {
			if (process.argv.length >= 2) {
				app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]]);
			}
		} else {
			app.setAsDefaultProtocolClient(PROTOCOL, process.execPath);
		}
	}

	AfterInit(app: Electron.CrossProcessExports.App): void | Promise<void> {
		app.on("open-url", (event, url) => {
			event.preventDefault();
			console.log("open-url", url);

			if (!url.startsWith(DEEPLINK_PREFIX)) {
				console.warn("Invalid deep link prefix:", url);
				return;
			}

			const path = url.slice(DEEPLINK_PREFIX.length);
			const [action, id] = path.split("/");

			if (!action || !id) {
				console.warn("Invalid deep link format:", url);
				return;
			}

			const mainWindow = BrowserWindow.getAllWindows()[0];
			if (!mainWindow) {
				console.warn("Main window not found");
				return;
			}

			switch (action) {
				case "play":
					mainWindow.webContents.send(IPC_EVENT_NAMES.TRACK_CONTROL, {
						type: "play",
						data: { videoId: id },
					});
					break;
				case "add":
					mainWindow.webContents.send(IPC_EVENT_NAMES.TRACK_CONTROL, {
						type: "add",
						data: { videoId: id },
					});
					break;
				case "channel":
					mainWindow.loadURL(`https://music.youtube.com/channel/${id}`);
					break;
				case "playlist":
					mainWindow.loadURL(`https://music.youtube.com/playlist?list=${id}`);
					break;
				default:
					console.warn("Unknown deep link action:", action);
			}
		});
	}

	BeforeStart() {}
}
