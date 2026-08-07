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
	private _settingsBound = false;

	get Tray() {
		return this._tray;
	}

	constructor(private app: App) {
		super("tray");
	}

	async AfterInit() {
		if (!this._settingsBound) {
			this._settingsBound = true;
			this.settingsInstance.onSettingChange(
				["app.autostart", "app.autoupdate", "app.minimizeTrayOverride", "discord.enabled", "discord.buttons", "themes.enabled", "themes.customFile", "themes.selected"],
				() => this.onSettingsChange(),
				{ debounce: 50 },
			);
		}
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
		// AfterInit re-runs on window reload — reuse tray to avoid menu-bar flicker / duplicate icons.
		if (this._tray && !this._tray.isDestroyed()) {
			try {
				this.buildMenu();
			} catch (err) {
				this.logger.error("Failed to rebuild tray menu", err);
			}
			return this._tray;
		}

		try {
			this._tray = new Tray(TracIconPath);
			this._tray.setToolTip("YouTube Music for Desktop");
			// Do not setContextMenu — macOS would steal left-click for the menu.
			try {
				this.buildMenu();
			} catch (err) {
				this.logger.error("Failed to build tray menu", err);
			}
			this._tray.setIgnoreDoubleClickEvents(true);
			this._tray.on("click", () => {
				void this.trayView.toggle();
			});
			this._tray.on("right-click", (_ev, bounds) => {
				try {
					const menu = this._menu ?? this.buildMenu();
					this._tray.popUpContextMenu(menu, bounds);
				} catch (err) {
					this.logger.error("Failed to pop tray menu", err);
				}
			});
			return this._tray;
		} catch (err) {
			this.logger.error("initializeTray failed", err);
			return undefined as unknown as Tray;
		}
	}

	private onSettingsChange() {
		if (this._tray && !this._tray.isDestroyed()) {
			try {
				this.buildMenu();
			} catch (err) {
				this.logger.error("Failed to rebuild tray menu on settings change", err);
			}
		}
	}

	async OnDestroy() {
		if (this._tray && !this._tray.isDestroyed()) this._tray.destroy();
	}
}
