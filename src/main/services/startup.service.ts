import { basename } from "path";
import { AfterInit, BaseProvider, BeforeStart } from "@main/utils/baseProvider";
import { IpcContext, IpcOn } from "@main/utils/onIpcEvent";
import { App, powerSaveBlocker } from "electron";

import { platform } from "@electron-toolkit/utils";
import { isProduction } from "@main/utils/devUtils";
import SettingsProvider from "./settings.service";

@IpcContext
export default class StartupProvider extends BaseProvider implements AfterInit, BeforeStart {
	get settingsInstance(): SettingsProvider {
		return this.getProvider("settings");
	}
	get isEnabled() {
		return !!this.settingsInstance.instance?.app?.autostart;
	}
	get isInitialMinimized() {
		return !!this.settingsInstance.instance?.app?.autostartMinimized;
	}
	constructor(private app: App) {
		super("startup");
		app.commandLine.appendSwitch("disable-http-cache");
		if (platform.isWindows) {
			app.commandLine.appendSwitch("enable-gpu-rasterization"); // performance feature flags
			app.commandLine.appendSwitch("enable-zero-copy");
			app.commandLine.appendSwitch("enable-features", "CanvasOopRasterization,EnableDrDc"); // Enables Display Compositor to use a new gpu thread. todo: testing
		}
		app.commandLine.appendSwitch("high-dpi-support", "1");
		app.commandLine.appendSwitch("force-device-scale-factor", "1");
		if (platform.isLinux) this.app.commandLine.appendSwitch("gtk-version", "3");
		this.app.commandLine.appendSwitch("ozone-platform-hint", "auto");
		this.app.commandLine.appendSwitch(
			"enable-features",
			["OverlayScrollbar", "SharedArrayBuffer", "UseOzonePlatform", "WaylandWindowDecorations", platform.isWindows && ["CanvasOopRasterization", "EnableDrDc"]]
				.flat()
				.filter(Boolean)
				.join(","),
		);
	}
	async BeforeStart() {
		if (this.settingsInstance.instance.app.disableHardwareAccel) this.app.disableHardwareAcceleration();
		if (!platform.isMacOS) {
			powerSaveBlocker.start("prevent-app-suspension"); // app suspension on mac prevents sleep
		}
	}
	private get startArgs() {
		return ["--processStart", `"${basename(process.execPath)}"`, "--startup"];
	}
	get isStartupContext() {
		return !!process.argv.find((arg) => arg === "--startup");
	}
	get isMinimizedArg() {
		return !!process.argv.find((arg) => arg === "--minimized");
	}
	async AfterInit() {
		const app = this.settingsInstance.instance.app;
		if (isProduction) {
			if (app.autostart) {
				this.app.setLoginItemSettings({
					openAtLogin: true,
					path: process.execPath,
					args: this.startArgs,
				});
			} else {
				this.app.setLoginItemSettings({
					openAtLogin: false,
					args: this.startArgs,
				});
			}
		}
	}
	@IpcOn("settingsProvider.change", {
		debounce: 1000,
		filter: (key: string) => key === "app.autostart",
	})
	private async onAutoStartToggle(key: string, enabled: boolean) {
		if (enabled) {
			this.app.setLoginItemSettings({
				openAtLogin: true,
				path: process.execPath,
				args: this.startArgs,
			});
		} else {
			this.app.setLoginItemSettings({
				openAtLogin: false,
				args: this.startArgs,
			});
		}
	}
}
