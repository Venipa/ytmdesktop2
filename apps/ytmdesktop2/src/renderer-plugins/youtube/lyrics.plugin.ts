import definePlugin from "@plugins/utils";
import { createLyricsStore } from "./lyrics/store";
import { createTabMount, type TabMountHandle } from "./lyrics/tab-mount";
import { shouldSkipTrack, trackInfoFromPlayer } from "./lyrics/track";
import { createLyricsRenderer, type LyricsRenderApi } from "./lyrics/ui/render";

const SEEK_OFFSET_MS = 10;
/** Nudge UI ahead of getCurrentTime — YTM clock often trails audible audio. */
const DISPLAY_LEAD_MS = 80;
const VIDEO_DATA_LOADED_TYPES = new Set(["dataupdated", "dataloaded", "newdata"]);

type LyricsLogger = { debug: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

interface LyricsRuntime {
	store: ReturnType<typeof createLyricsStore>;
	mount: TabMountHandle | null;
	renderer: LyricsRenderApi | null;
	unsubStore: (() => void) | null;
	unsubSettings: (() => void) | null;
	timeRaf: number;
	onVideoDataChange: ((ev: { playertype?: number | string; type?: string }) => void) | null;
	playerApi: any;
	domUtils: Window["domUtils"] | null;
	log: LyricsLogger | null;
	onSettingsChange: ((fn: (key: string, value: any) => void) => () => void) | null;
	active: boolean;
	tabSelected: boolean;
	started: boolean;
}

const runtime: LyricsRuntime = {
	store: createLyricsStore(),
	mount: null,
	renderer: null,
	unsubStore: null,
	unsubSettings: null,
	timeRaf: 0,
	onVideoDataChange: null,
	playerApi: null,
	domUtils: null,
	log: null,
	onSettingsChange: null,
	active: false,
	tabSelected: false,
	started: false,
};

function readLyricsSettings(settings?: Record<string, any>) {
	const s = settings ?? window.__ytd_settings ?? {};
	return {
		enabled: !!s?.lyrics?.enabled,
		showTimeCodes: !!s?.lyrics?.showTimeCodes,
		showEvenIfInexact: s?.lyrics?.showEvenIfInexact !== false,
		showProgressBar: s?.lyrics?.showProgressBar !== false,
		showWordSync: !!s?.lyrics?.showWordSync,
	};
}

function refreshTrack() {
	if (!runtime.active) return;
	const info = trackInfoFromPlayer(runtime.playerApi ?? {});
	const skip = shouldSkipTrack(info);
	if (skip || !info) {
		runtime.store.setSkipped(info?.videoId ?? null, skip ?? "No track");
		return;
	}
	const cfg = readLyricsSettings();
	void runtime.store.fetchForTrack(info, { showEvenIfInexact: cfg.showEvenIfInexact });
}

function pushPlaybackTime() {
	if (!runtime.renderer) return;
	try {
		const t = Number(runtime.playerApi?.getCurrentTime?.() ?? 0);
		runtime.renderer.setTime(t * 1000 + DISPLAY_LEAD_MS);
	} catch {
		/* player may be mid-navigate */
	}
}

function tickPlaybackTime() {
	runtime.timeRaf = 0;
	if (!runtime.active || !runtime.renderer || !runtime.tabSelected) return;
	pushPlaybackTime();
	runtime.timeRaf = requestAnimationFrame(tickPlaybackTime);
}

function startTimePoll() {
	if (runtime.timeRaf) return;
	runtime.timeRaf = requestAnimationFrame(tickPlaybackTime);
}

function stopTimePoll() {
	if (runtime.timeRaf) cancelAnimationFrame(runtime.timeRaf);
	runtime.timeRaf = 0;
}

function unbindPlayer() {
	if (runtime.onVideoDataChange) {
		try {
			runtime.playerApi?.removeEventListener?.("onVideoDataChange", runtime.onVideoDataChange);
		} catch {
			/* ignore */
		}
	}
	runtime.onVideoDataChange = null;
}

function bindPlayer() {
	unbindPlayer();
	runtime.playerApi = window.domUtils?.playerApi?.() ?? runtime.playerApi;
	runtime.onVideoDataChange = (ev) => {
		const type = String(ev?.type ?? "").toLowerCase();
		if (!VIDEO_DATA_LOADED_TYPES.has(type)) return;
		if (ev?.playertype != null && Number(ev.playertype) !== 1) return;
		refreshTrack();
	};
	try {
		runtime.playerApi?.addEventListener?.("onVideoDataChange", runtime.onVideoDataChange);
	} catch (err) {
		runtime.log?.error("lyrics: failed to bind onVideoDataChange", err);
	}
}

async function startLyrics() {
	if (runtime.active) return;
	if (!runtime.domUtils) throw new Error("lyrics: not initialized");
	runtime.active = true;
	runtime.log?.debug("lyrics: start");

	runtime.mount = await createTabMount(runtime.domUtils, {
		onHostChange: () => {
			runtime.renderer?.repaint();
		},
		onTabSelectedChange: (selected) => {
			runtime.tabSelected = selected;
			if (selected) {
				pushPlaybackTime();
				startTimePoll();
			} else {
				stopTimePoll();
			}
		},
	});
	runtime.tabSelected = runtime.mount.isLyricsTabSelected();

	runtime.renderer = createLyricsRenderer(() => runtime.mount?.getHost() ?? null, {
		showTimeCodes: () => readLyricsSettings().showTimeCodes,
		showProgressBar: () => readLyricsSettings().showProgressBar,
		showWordSync: () => readLyricsSettings().showWordSync,
		onSeek: (timeMs) => {
			try {
				runtime.playerApi?.seekTo?.((timeMs + SEEK_OFFSET_MS) / 1000, true);
			} catch (err) {
				runtime.log?.debug("lyrics: seek failed", err);
			}
		},
	});

	runtime.unsubStore = runtime.store.subscribe((snap) => runtime.renderer?.setSnapshot(snap));
	runtime.unsubSettings =
		runtime.onSettingsChange?.((key) => {
			if (
				key === "lyrics.showTimeCodes" ||
				key === "lyrics.showProgressBar" ||
				key === "lyrics.showWordSync"
			) {
				runtime.renderer?.repaint();
			}
			if (key === "lyrics.showEvenIfInexact") refreshTrack();
		}) ?? null;

	bindPlayer();
	if (runtime.tabSelected) startTimePoll();
	refreshTrack();
	runtime.renderer.repaint();
}

function stopLyrics() {
	if (!runtime.active && !runtime.mount) return;
	runtime.log?.debug("lyrics: stop");
	runtime.active = false;
	runtime.tabSelected = false;
	stopTimePoll();
	unbindPlayer();
	runtime.unsubStore?.();
	runtime.unsubStore = null;
	runtime.unsubSettings?.();
	runtime.unsubSettings = null;
	runtime.renderer?.destroy();
	runtime.renderer = null;
	runtime.mount?.destroy();
	runtime.mount = null;
	runtime.store.clear();
}

export default definePlugin(
	"lyrics",
	{
		enabled: true,
		displayName: "Synced Lyrics",
	},
	{
		async afterInit({ settings, domUtils, log, playerApi, onSettingsChange }) {
			runtime.domUtils = domUtils;
			runtime.log = log;
			runtime.playerApi = playerApi;
			runtime.onSettingsChange = onSettingsChange;
			runtime.started = true;

			if (readLyricsSettings(settings).enabled) {
				await startLyrics();
			}
		},
		cmds: {
			async enable({ log }) {
				log.debug("lyrics cmd enable");
				await startLyrics();
			},
			async disable({ log }) {
				log.debug("lyrics cmd disable");
				stopLyrics();
			},
		},
	},
);
