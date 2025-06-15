import { readFileSync, rmSync, statSync } from "fs";
import path from "path";
import { createYmlStore } from "@main/lib/store/createYmlStore";
import { AfterInit, BaseProvider, BeforeStart, OnDestroy } from "@main/utils/baseProvider";
import { defaultUri, defaultUrl, isDevelopment } from "@main/utils/devUtils";
import eventNames from "@main/utils/eventNames";
import { IpcContext, IpcHandle, IpcOn } from "@main/utils/onIpcEvent";
import { serverMain } from "@main/utils/serverEvents";
import { VideoResSetting } from "@shared/utils/ISettings";
import { App, IpcMainEvent, IpcMainInvokeEvent, app } from "electron";
import { get as _get, debounce } from "lodash-es";
import { Subject, distinctUntilChanged, filter, map, startWith, takeUntil } from "rxjs";
import { LastFMSettings } from "ytmd";
import { stringifyJson } from "../lib/json";
import { CustomCssConfig } from "./customCssProvider.plugin";

const defaultSettings = {
	api: {
		enabled: isDevelopment ? true : false,
		port: 13091,
	},
	app: {
		beta: false,
		autoupdate: true,
		autostart: true,
		autostartMinimized: true,
		getstarted: true,
		enableDev: false,
		minimizeTrayOverride: false,
		enableStatisticsAndErrorTracing: true,
		disableHardwareAccel: false,
	},
	volumeRatio: {
		enabled: true,
	},
	player: {
		skipDisliked: false,
		res: {
			enabled: false,
			prefer: "auto",
		} as VideoResSetting,
	},
	discord: {
		enabled: true,
		buttons: false,
	},
	customcss: {
		enabled: true,
		scssFile: null,
		watching: false,
	} as CustomCssConfig,
	state: {
		currentUrl: null,
	},
	lastfm: {
		enabled: false,
	} as LastFMSettings,
};

export type SettingsStore = typeof defaultSettings & { [key: string]: any };

const _settingsStore = createYmlStore<SettingsStore>("app-settings", {
	defaults: defaultSettings as SettingsStore,
	migrations: [
		{
			version: 0,
			hook(store) {
				const { migratedFromJson } = store.store?.__meta ?? {};
				if (migratedFromJson) return;
				const oldConfigPath = path.resolve(app.getPath("userData"), "app-settings.json");
				if (!statSync(oldConfigPath, { throwIfNoEntry: false })) {
					store.set("__meta.migratedFromJson", true);
					return;
				}
				const oldConfigBody = readFileSync(oldConfigPath, "utf8");
				if (!oldConfigBody) return;
				rmSync(oldConfigPath);
				const oldConfig = JSON.parse(oldConfigBody);
				store.set(oldConfig);
				store.set("__meta.migratedFromJson", true);
			},
		},
	],
});

@IpcContext
export default class SettingsProvider extends BaseProvider implements OnDestroy, BeforeStart, AfterInit {
	readonly onChange = new Subject<SettingsStore>();

	onChangeProp(key: string) {
		const settings = this.instance;
		return this.onChange.pipe(takeUntil(this.onChange), startWith(settings)).pipe(
			map((value) => _get(value, key, null)),
			filter(Boolean),
			distinctUntilChanged((l, r) => stringifyJson(l) === stringifyJson(r)),
		);
	}

	constructor(private app: App) {
		super("settings");
	}

	private getConfigPath() {
		return path.resolve(this.app.getPath("userData"), "app-settings.json");
	}

	async BeforeStart() {
		const configFile = this.getConfigPath();
		this.logger.debug(configFile);
	}

	get instance() {
		return _settingsStore.store;
	}

	get<T = any>(key: string, defaultValue?: any): T {
		return _get(_settingsStore.store, key, defaultValue);
	}

	set(key: string, value: any) {
		_settingsStore.set(key, value ?? null);
		this.onChange.next(_settingsStore.store);
		try {
			serverMain.emit(eventNames.SERVER_SETTINGS_CHANGE, key, value);
			this.windowContext.sendToAllViews(eventNames.SERVER_SETTINGS_CHANGE, key, value);
		} catch (ex) {
			this.logger.error(ex);
		}
		return this;
	}

	@IpcOn("settingsProvider.save", {
		debounce: 5000,
	})
	saveToDrive() {}

	async OnDestroy() {
		this.onChange.complete();
		this.saveToDrive();
	}

	AfterInit() {
		this.views.youtubeView.webContents.on("did-navigate-in-page", (ev, location) => {
			this.logger.debug(`navigate-in-page :: ${location}`);
			const url = new URLSearchParams(location.split("?")[1]);
			if (url?.has("v")) this.getProvider("track").setActiveTrack(url.get("v"));
		});

		let previousHostname: string = defaultUrl;
		this.views.youtubeView.webContents.on(
			"did-navigate",
			debounce((ev: Electron.Event, location: string) => {
				this.logger.debug("navigate", location);
				const url = new URL(location);
				if (url) {
					if (url.hostname === defaultUri.hostname && previousHostname !== url.hostname) {
						serverMain.emit("customcss.update");
					}
					previousHostname = url.hostname;
					if (url.hostname !== defaultUri.hostname) {
						this.views.toolbarView.webContents.send("track:title", null); // disable title bar track title
					}
				}
			}, 500),
		);
	}

	@IpcHandle("settingsProvider.get")
	private _onEventGet(ev: IpcMainInvokeEvent, ...args: any[]) {
		const [key, value] = args;
		const returnValue = this.get(key);
		return returnValue === undefined || returnValue === null ? value : returnValue;
	}

	@IpcHandle("settingsProvider.getAll")
	private _onEventGetAll(ev: IpcMainInvokeEvent, ...args: any[]) {
		const [value] = args;
		const returnValue = _settingsStore.store;
		return returnValue === undefined || returnValue === null ? value : returnValue;
	}

	@IpcOn("settingsProvider.set")
	private _onEventSet(ev: IpcMainEvent, ...args: any[]) {
		const [key, value] = args;
		this.set(key, value);
		this.logger.debug(key, value);
		this.saveToDrive();
	}

	@IpcHandle("settingsProvider.update")
	private async _onEventUpdate(ev: IpcMainInvokeEvent, ...args: any[]) {
		const [key, value] = args;
		this.logger.debug(key, value);
		this.set(key, value);
		this.saveToDrive();
		return value;
	}
}
