import { platform } from "@electron-toolkit/utils";
import { AfterInit, BaseProvider, OnDestroy, OnInit } from "@main/core/baseProvider";
import { createTrayNativeImage } from "@main/domain/trayIcon";
import { createTrayMenu } from "@main/domain/trayMenu";
import SettingsProvider from "@main/trpc/routers/settings/service";
import TrayViewProvider from "@main/trpc/routers/trayView/service";
import { App, Menu, Tray } from "electron";

export default class TrayProvider extends BaseProvider implements OnInit, AfterInit, OnDestroy {
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

	/** Create menu-bar / notification-area icon as soon as app is ready — do not wait for window load. */
	async OnInit() {
		await this.initializeTray();
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
		// Ensure tray exists even if OnInit was skipped somehow.
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
		if (this._tray && !this._tray.isDestroyed()) {
			try {
				this.buildMenu();
			} catch (err) {
				this.logger.error("Failed to rebuild tray menu", err);
			}
			return this._tray;
		}

		try {
			const icon = createTrayNativeImage();
			if (icon.isEmpty()) {
				this.logger.error("Tray NativeImage empty — status item may be invisible");
			} else {
				this.logger.debug("Tray icon ready", icon.getSize(), { template: icon.isTemplateImage() });
			}

			this._tray = new Tray(icon);
			this._tray.setToolTip("YouTube Music for Desktop");

			// macOS: if glyph fails, short title still creates a visible status item.
			if (platform.isMacOS && icon.isEmpty()) {
				this._tray.setTitle("YT");
			}

			try {
				this.buildMenu();
			} catch (err) {
				this.logger.error("Failed to build tray menu", err);
			}

			// Do not setContextMenu — macOS would steal left-click for the menu.
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

			this.logger.debug("Tray created", {
				platform: process.platform,
				bounds: this._tray.getBounds(),
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
