import translations from "@translations/index";
import { Menu, shell } from "electron";
import AppProvider from "../services/app.service";
import SettingsProvider from "../services/settings.service";
import { BaseProvider } from "./baseProvider";
import { serverMain } from "./serverEvents";

export const createTrayMenu = (provider: BaseProvider) => {
	const { set, instance: settings } = provider.getProvider("settings") as SettingsProvider;
	const { app } = provider.getProvider("app") as AppProvider;
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
			checked: settings.app.autostart,
			click: (item) => {
				set("app.autostart", item.checked);
			},
		},
		{
			label: "Auto Update",
			type: "checkbox",
			checked: settings.app.autoupdate,
			click: (item) => {
				set("app.autoupdate", item.checked);
			},
		},
		{
			type: "separator",
		},
		{
			label: "Settings",
			click: () => {
				serverMain.emit("subwindow.show", null, "settingsWindow");
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
					checked: settings.discord.enabled,
					click: (item) => {
						set("discord.enabled", item.checked);
					},
				},
				{
					label: "Show Buttons",
					type: "checkbox",
					checked: settings.discord.buttons,
					click: (item) => {
						set("discord.buttons", item.checked);
					},
				},
			],
		},
		{
			type: "separator",
		},
		{
			type: "submenu",
			label: "Custom CSS",
			submenu: [
				{
					label: "Enable CSS",
					type: "checkbox",
					checked: settings.customcss.enabled,
					click: (item) => {
						set("customcss.enabled", item.checked);
					},
				},
				{
					label: "Open selected CSS File",
					enabled: settings.customcss.enabled && !!settings.customcss.scssFile,
					click: (item) => {
						if (item.enabled) shell.openExternal(settings.customcss.scssFile!);
					},
				},
				{
					label: "Change CSS File",
					enabled: settings.customcss.enabled,
					click: (item) => {
						if (item.enabled) serverMain.emit("subwindow.show", null, "settingsWindow");
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
