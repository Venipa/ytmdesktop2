import { AfterInit, BaseProvider } from "@main/core/baseProvider";
import { getWindowFromContents } from "@main/windows/webContentUtils";
import { createAppWindow, wrapWindowHandler } from "@main/windows/windowUtils";
import { App, IpcMainInvokeEvent } from "electron";

export default class MiniPlayerProvider extends BaseProvider implements AfterInit {
	constructor(private _app: App) {
		super("mp");
	}
	get app() {
		return this._app;
	}
	async AfterInit() {}
	private async __onPlayerTop(ev: IpcMainInvokeEvent) {
		const window = getWindowFromContents(ev.sender);
		if (!window || window.isDestroyed()) return false;
		const isOnTop = !window.isAlwaysOnTop();
		window.setAlwaysOnTop(isOnTop);
		return isOnTop;
	}
	private async __isPlayerTop(ev: IpcMainInvokeEvent) {
		const window = getWindowFromContents(ev.sender);
		if (!window || window.isDestroyed()) return false;
		const isOnTop = window.isAlwaysOnTop();
		return isOnTop;
	}

	async openMiniPlayer() {
		let mpId: number;
		let mpWindow = this.windowContext.views.miniPlayerWindow;
		if (!mpWindow || mpWindow.isDestroyed()) {
			this.windowContext.views.miniPlayerWindow = mpWindow = await createAppWindow({
				path: "/miniplayer",
				minWidth: 340,
				minHeight: 340,
				height: 340,
				width: 540,
			});

			const { state, saveState } = await wrapWindowHandler(mpWindow, "miniPlayer", {
				width: 540,
				height: 340,
			});

			if (state) {
				mpWindow.setBounds(state);
			} else {
				mpWindow.setBounds({ width: 540, height: 340 });
			}

			mpWindow.setMinimizable(true);
			this.windowContext.main.hide();
			mpWindow.on("close", () => {
				this.windowContext.main.show();
				saveState();
			});
			mpId = mpWindow.id;
		} else {
			mpId = mpWindow.id;
			mpWindow.show();
		}
		this.windowContext.sendToAllViews("miniplayer.state", !this.views.miniPlayerWindow ? null : { active: false });
		return mpId;
	}

	private async __playerWindow() {
		return this.openMiniPlayer();
	}
}
