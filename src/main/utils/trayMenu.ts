import translations from "@translations/index";
import { Menu, shell } from "electron";
import AppProvider from "../services/app.service";
import SettingsProvider from "../services/settings.service";
import { BaseProvider } from "./baseProvider";
import { serverMain } from "./serverEvents";

export const createTrayMenu = (provider: BaseProvider) => {
	const settings = provider.getProvider("settings") as SettingsProvider;
	const { instance: sp } = settings;
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
			label: "Custom CSS",
			submenu: [
				{
					label: "Enable CSS",
					type: "checkbox",
					checked: sp.customcss.enabled,
					click: (item) => {
						settings.set("customcss.enabled", item.checked);
					},
				},
				{
					label: "Open selected CSS File",
					enabled: sp.customcss.enabled && !!sp.customcss.scssFile,
					click: (item) => {
						if (item.enabled && sp.customcss?.scssFile) shell.openExternal(sp.customcss.scssFile!);
					},
				},
				{
					label: "Change CSS File",
					enabled: sp.customcss.enabled,
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
