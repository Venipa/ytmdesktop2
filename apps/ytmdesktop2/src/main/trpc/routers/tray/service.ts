import { AfterInit, BaseProvider, OnDestroy } from "@main/core/baseProvider";
import { createTrayMenu } from "@main/domain/trayMenu";
import SettingsProvider from "@main/trpc/routers/settings/service";
import TrayViewProvider from "@main/trpc/routers/trayView/service";
import { App, Menu, Tray } from "electron";
import TracIconPath from "~/build/favicon.ico?asset";

export default class TrayProvider extends BaseProvider implements AfterInit, OnDestroy {
	get settingsInstance(): SettingsProvider {
		return this.getProvider("settings");
	}
	private _tray!: Tray;
	private _menu: Menu | null = null;

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
		this._menu = createTrayMenu(this);
		return this._menu;
	}

	private get trayView(): TrayViewProvider {
		return this.getProvider("trayView");
	}

	async initializeTray() {
		if (this._tray && !this._tray.isDestroyed()) this._tray.destroy();
		this._tray = new Tray(TracIconPath);
		this._tray.setToolTip(`YouTube Music for Desktop`);
		// Do not setContextMenu — macOS would steal left-click for the menu.
		this.buildMenu();
		this._tray.setIgnoreDoubleClickEvents(true);
		this._tray.on("click", () => {
			void this.trayView.toggle();
		});
		this._tray.on("right-click", (_ev, bounds) => {
			const menu = this._menu ?? this.buildMenu();
			this._tray.popUpContextMenu(menu, bounds);
		});
		return this._tray;
	}

	private onSettingsChange() {
		if (this._tray) this.buildMenu();
	}

	async OnDestroy() {
		if (this._tray && !this._tray.isDestroyed()) this._tray.destroy();
	}
}
