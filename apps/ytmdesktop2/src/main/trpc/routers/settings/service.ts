import { AfterInit, BaseProvider, BeforeStart, OnDestroy } from "@main/core/baseProvider";
import { applyYoutubeZoom, clampZoomFactor, setZoomFactorState } from "@main/domain/uiZoom";
import { defaultUri, defaultUrl, isDevelopment } from "@main/infra/devUtils";
import { serverMain } from "@main/ipc/serverEvents";
import { stringifyJson } from "@main/lib/json";
import { createYmlStore } from "@main/lib/store/createYmlStore";
import type { ThemesConfig } from "@main/trpc/routers/themes/types";
import { trackService } from "@main/trpc/routers/track";
import eventNames from "@shared/constants/eventNames";
import { VideoResSetting } from "@shared/utils/ISettings";
import { App, IpcMainEvent, IpcMainInvokeEvent } from "electron";
import { Migration } from "electron-conf";
import { get as _get, debounce } from "lodash-es";
import { distinctUntilChanged, filter, map, Subject, startWith, takeUntil } from "rxjs";
import { LastFMSettings } from "ytmd";
import migrations from "./migrations";

const defaultSettings = {
	api: {
		enabled: isDevelopment ? true : false,
		port: 13091,
		authRequired: false,
	},
	app: {
		channel: "stable" as "stable" | "beta" | "alpha",
		autoupdate: true,
		autostart: true,
		autostartMinimized: true,
		getstarted: true,
		enableDev: false,
		minimizeTrayOverride: false,
		enableStatisticsAndErrorTracing: true,
		disableHardwareAccel: false,
		enableTaskbarProgress: true,
		zoomFactor: 1,
	},
	trayView: {
		pinned: false,
	},
	volumeRatio: {
		enabled: true,
		volume: 0.05,
	},
	lyrics: {
		enabled: false,
		showTimeCodes: false,
		showEvenIfInexact: true,
		showProgressBar: true,
		providers: [
			{ id: "better-lyrics", enabled: true },
			{ id: "unison", enabled: true },
			{ id: "lrclib", enabled: true },
		] as Array<{ id: "better-lyrics" | "unison" | "lrclib"; enabled: boolean }>,
	},
	player: {
		skipDisliked: false,
		/** `ask` = confirm dialog; `play` = open watch immediately */
		deepLinkOpen: "ask" as "ask" | "play",
		/** Rewrite YTM “Copy link” clipboard URLs to `ytmd://` */
		replaceShareLinks: true,
		res: {
			enabled: false,
			prefer: "auto",
		} as VideoResSetting,
	},
	discord: {
		enabled: true,
		buttons: false,
	},
	themes: {
		enabled: true,
		selected: "default",
		customFile: null,
		watching: false,
		thumbnailBackground: true,
		blur: true,
	} as ThemesConfig,
	state: {
		currentUrl: null,
	},
	lastfm: {
		enabled: false,
	} as LastFMSettings,
};

export type SettingsStore = typeof defaultSettings & {
	__meta?: { migratedFromJson?: boolean };
	plugins?: {
		bypass_age_restrictions?: { enabled: boolean };
	};
};

const _settingsStore = createYmlStore<SettingsStore>("app-settings", {
	defaults: defaultSettings as SettingsStore,
	migrations: migrations.map(
		(migration, version) =>
			({
				version,
				...migration,
			}) as Migration<SettingsStore>,
	),
});

export default class SettingsProvider extends BaseProvider implements OnDestroy, BeforeStart, AfterInit {
	readonly onChange = new Subject<SettingsStore>();
	readonly settingChanged = new Subject<{ key: string; value: unknown; prevValue: unknown }>();

	onChangeProp(key: string) {
		const settings = this.instance;
		return this.onChange.pipe(takeUntil(this.onChange), startWith(settings)).pipe(
			map((value) => _get(value, key, null)),
			filter(Boolean),
			distinctUntilChanged((l, r) => stringifyJson(l) === stringifyJson(r)),
		);
	}

	/** Main-process side effects when a setting key changes. Prefer this over serverMain.on. */
	onSettingChange(
		keys: string | string[],
		handler: (value: unknown, prevValue: unknown, key: string) => void,
		options?: { debounce?: number },
	): { unsubscribe(): void } {
		const keyList = Array.isArray(keys) ? keys : [keys];
		// Filter before debounce so unrelated settingChanged events cannot drop matching updates.
		const run = options?.debounce
			? debounce((ev: { key: string; value: unknown; prevValue: unknown }) => {
					handler(ev.value, ev.prevValue, ev.key);
				}, options.debounce)
			: (ev: { key: string; value: unknown; prevValue: unknown }) => {
					handler(ev.value, ev.prevValue, ev.key);
				};
		const sub = this.settingChanged.subscribe((ev) => {
			if (!keyList.includes(ev.key)) return;
			run(ev);
		});
		return { unsubscribe: () => sub.unsubscribe() };
	}

	constructor(private app: App) {
		super("settings");
		this.bindIpc();
	}

	private bindIpc() {
		serverMain.on("settingsProvider.save", debounce(() => this.saveToDrive(), 5000));
		serverMain.handle("settingsProvider.get", (ev, ...args) => this._onEventGet(ev, ...args));
		serverMain.handle("settingsProvider.getAll", (ev, ...args) => this._onEventGetAll(ev, ...args));
		serverMain.on("settingsProvider.set", (ev, ...args) => this._onEventSet(ev, ...args));
		serverMain.handle("settingsProvider.update", (ev, ...args) => this._onEventUpdate(ev, ...args));
	}

	async BeforeStart() {
		setZoomFactorState(this.get("app.zoomFactor", 1));
	}

	get instance() {
		return _settingsStore.store;
	}

	get<T = unknown>(key: string, defaultValue?: T): T {
		return _get(_settingsStore.store, key, defaultValue) as T;
	}

	set(key: string, value: unknown) {
		let nextValue = value ?? null;
		if (key === "app.zoomFactor") {
			nextValue = clampZoomFactor(nextValue);
		}
		const prevValue = this.get(key);
		if (stringifyJson(prevValue) === stringifyJson(nextValue)) {
			// Store unchanged — still re-apply zoom (Chromium / view can drift).
			if (key === "app.zoomFactor") applyYoutubeZoom(nextValue);
			return this;
		}

		_settingsStore.set(key, nextValue);
		this.onChange.next(_settingsStore.store);
		this.settingChanged.next({ key, value: nextValue, prevValue });
		try {
			// Youtube preload plugins still listen via webContents IPC.
			this.views.youtubeView?.webContents.send(eventNames.SERVER_SETTINGS_CHANGE, key, nextValue, prevValue);
			// BaseEvent / debug listeners on main bus (no renderer round-trip).
			serverMain.emitServer(eventNames.SERVER_SETTINGS_CHANGE, key, nextValue, prevValue);
		} catch (ex) {
			this.logger.error(ex);
		}
		return this;
	}

	saveToDrive() {}

	async OnDestroy() {
		this.onChange.complete();
		this.settingChanged.complete();
		this.saveToDrive();
	}

	AfterInit() {
		this.views.youtubeView.webContents.on("did-navigate-in-page", (ev, location) => {
			this.logger.debug(`navigate-in-page :: ${location}`);
			const url = new URLSearchParams(location.split("?")[1]);
			if (url?.has("v")) {
				const videoId = url.get("v");
				if (videoId) trackService.setActiveTrack(videoId);
			}
		});

		let previousHostname: string = defaultUrl;
		this.views.youtubeView.webContents.on(
			"did-navigate",
			debounce((ev: Electron.Event, location: string) => {
				this.logger.debug("navigate", location);
				const url = new URL(location);
				if (url) {
					if (url.hostname === defaultUri.hostname && previousHostname !== url.hostname) {
						void this.getProvider("themes").reapplyAllStyles();
					}
					previousHostname = url.hostname;
					if (url.hostname !== defaultUri.hostname) {
						// clear track UI via same onTrack stream
						serverMain.emit(eventNames.TRACK_CHANGE, null);
					}
				}
			}, 500),
		);
	}

	private _onEventGet(ev: IpcMainInvokeEvent, ...args: any[]) {
		const [key, value] = args;
		const returnValue = this.get(key);
		return returnValue === undefined || returnValue === null ? value : returnValue;
	}

	private _onEventGetAll(ev: IpcMainInvokeEvent, ...args: any[]) {
		const [value] = args;
		const returnValue = _settingsStore.store;
		return returnValue === undefined || returnValue === null ? value : returnValue;
	}

	private _onEventSet(ev: IpcMainEvent, ...args: any[]) {
		const [key, value] = args;
		this.set(key, value);
		this.logger.debug(key, value);
		this.saveToDrive();
	}

	private async _onEventUpdate(ev: IpcMainInvokeEvent, ...args: any[]) {
		const [key, value] = args;
		this.logger.debug(key, value);
		this.set(key, value);
		this.saveToDrive();
		return value;
	}
}
