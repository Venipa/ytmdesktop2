import { AfterInit, BaseProvider, OnDestroy } from "@main/core/baseProvider";
import { createTrayMenu } from "@main/domain/trayMenu";
import { setTrayState } from "@main/handlers/trayState";
import { isDevelopment } from "@main/infra/devUtils";
import SettingsProvider from "@main/trpc/routers/settings/service";
import { createAppWindow } from "@main/windows/windowUtils";
import { App, BrowserWindow, Tray } from "electron";
import TracIconPath from "~/build/favicon.ico?asset";
export default class TrayProvider extends BaseProvider implements AfterInit, OnDestroy {
	get settingsInstance(): SettingsProvider {
		return this.getProvider("settings");
	}
	private _tray!: Tray;
	get Tray() {
		return this._tray;
	}
	constructor(private app: App) {
		super("tray");
	}
	async AfterInit() {
		this.settingsInstance.onSettingChange(
			["app.autostart", "app.autoupdate", "app.minimizeTrayOverride", "discord.enabled", "discord.buttons", "themes.enabled", "themes.customFile", "themes.selected"],
			() => this.onSettingsChange(),
			{ debounce: 50 },
		);
		await this.initializeTray();
	}

	private buildMenu() {
		return createTrayMenu(this);
	}
	async initializeTray() {
		if (this._tray && !this._tray.isDestroyed()) this._tray.destroy();
		this._tray = new Tray(TracIconPath);
		this._tray.setToolTip(`YouTube Music for Desktop`);
		this._tray.setContextMenu(this.buildMenu());
		this._tray.setIgnoreDoubleClickEvents(true);
		this._tray.on("click", () => {
			const window = BrowserWindow.fromWebContents(this.views.youtubeView.webContents);
			if (window) {
				window.show();
				setTrayState("visible");
			}
			// if (!ev.triggeredByAccelerator && isDevelopment) this.__trayWindow(); // todo
		});
		return this._tray;
	}
	private onSettingsChange() {
		if (this._tray) this._tray.setContextMenu(this.buildMenu());
	}

	async openTaskView() {
		let mpId: number;
		let mpWindow = this.windowContext.views.taskViewWindow as any as BrowserWindow;
		if (!mpWindow || mpWindow.isDestroyed()) {
			const width = 400,
				height = 300;
			mpWindow = await createAppWindow({
				// parent: this.windowContext.main,
				path: "/taskview",
				minWidth: width,
				minHeight: height,
				height,
				width,
				maxHeight: height,
				maxWidth: width,
				showTaskBar: false,
				minimizeable: false,
				maximizeable: false,
			});
			mpWindow.setAlwaysOnTop(true, "pop-up-menu");
			mpWindow.setResizable(false);
			mpWindow.on("close", (ev) => {
				ev.preventDefault();
				mpWindow.hide();
			});
			if (!isDevelopment)
				mpWindow.on("blur", () => {
					mpWindow.close();
				});

			mpWindow.webContents.on("before-input-event", (ev, input) => {
				if (input.key === "esc") mpWindow.close();
			});
			const trayBounds = this._tray.getBounds();
			mpWindow.setBounds({
				x: trayBounds.x + trayBounds.width - width,
				y: trayBounds.y + trayBounds.height - height,
				height,
				width,
			});
			this.windowContext.views.taskViewWindow = mpWindow as any;
			mpId = mpWindow.id;
		} else {
			mpId = mpWindow.id;
			mpWindow.show();
			// mpWindow.destroy();
		}
		this.windowContext.sendToAllViews("taskview.state", !this.views.taskViewWindow ? null : { active: false });
		return mpId;
	}

	private async __trayWindow() {
		return this.openTaskView();
	}
	async OnDestroy() {
		(this.views.taskViewWindow as any as BrowserWindow)?.destroy();
	}
}
