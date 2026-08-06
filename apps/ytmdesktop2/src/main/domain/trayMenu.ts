import { BaseProvider } from "@main/core/baseProvider";
import { serverMain } from "@main/ipc/serverEvents";
import AppProvider from "@main/trpc/routers/app/service";
import SettingsProvider from "@main/trpc/routers/settings/service";
import translations from "@translations/index";
import { Menu, shell } from "electron";

export const createTrayMenu = (provider: BaseProvider) => {
	const settings = provider.getProvider("settings") as SettingsProvider;
	const { instance: sp } = settings;
	const appProvider = provider.getProvider("app") as AppProvider;
	const { app } = appProvider;
	const { updateAvailable, onCheckUpdate: checkUpdate, onAutoUpdateRun: applyUpdate, updateInfo } = provider.getProvider("update");
	const menu = Menu.buildFromTemplate([
		{
			label: translations.appName,
			sublabel: `Version: ${app.getVersion()}`,
			click: () => serverMain.emit("app.trayState", null, "visible"),
		},
		{
			label: updateAvailable ? `Update Available - ${updateInfo?.version ? `Download v${updateInfo.version}` : "Download"}` : "Check for Updates",
			click: () => (updateAvailable ? applyUpdate(null, false) : checkUpdate()),
		},
		{
			type: "separator",
		},
		{
			label: "Auto Startup",
			type: "checkbox",
			checked: sp.app.autostart,
			click: (item) => {
				settings.set("app.autostart", item.checked);
			},
		},
		{
			label: "Auto Update",
			type: "checkbox",
			checked: sp.app.autoupdate,
			click: (item) => {
				settings.set("app.autoupdate", item.checked);
			},
		},
		{
			label: "Enable Quit to Tray",
			type: "checkbox",
			checked: sp.app.minimizeTrayOverride,
			click: (item) => {
				settings.set("app.minimizeTrayOverride", item.checked);
			},
		},
		{
			type: "separator",
		},
		{
			label: "Settings",
			click: () => {
				void appProvider.openSettingsWindow();
			},
		},
		{
			type: "separator",
		},
		{
			type: "submenu",
			label: "Discord",
			submenu: [
				{
					label: "Show Presence",
					type: "checkbox",
					checked: sp.discord.enabled,
					click: (item) => {
						settings.set("discord.enabled", item.checked);
					},
				},
				{
					label: "Show Buttons",
					type: "checkbox",
					checked: sp.discord.buttons,
					click: (item) => {
						settings.set("discord.buttons", item.checked);
					},
				},
			],
		},
		{
			type: "separator",
		},
		{
			type: "submenu",
			label: "Themes",
			submenu: [
				{
					label: "Enable Themes",
					type: "checkbox",
					checked: sp.themes.enabled,
					click: (item) => {
						settings.set("themes.enabled", item.checked);
					},
				},
				{
					label: "Open custom theme file",
					enabled: sp.themes.enabled && sp.themes.selected === "custom" && !!sp.themes.customFile,
					click: (item) => {
						if (item.enabled && sp.themes?.customFile) void shell.openPath(sp.themes.customFile!);
					},
				},
				{
					label: "Change Theme",
					enabled: sp.themes.enabled,
					click: (item) => {
						if (item.enabled) void appProvider.openSettingsWindow();
					},
				},
			],
		},
		{
			type: "separator",
		},
		{
			label: "Quit",
			click: () => serverMain.emit("app.quit", null, true),
		},
	]);
	return menu;
};
