import definePlugin from "@plugins/utils";
import { getYtmd } from "@preload/preload-local";
import { createLyricsStore } from "./lyrics/store";
import { createTabMount, type TabMountHandle } from "./lyrics/tab-mount";
import {
	seekPlayer,
	shouldSkipTrack,
	startLyricsClock,
	stopLyricsClock,
	trackInfoFromMainWorld,
} from "./lyrics/track";
import { createLyricsRenderer, type LyricsRenderApi } from "./lyrics/ui/render";
import { lyricsPage, subscribeLyricsTime } from "./lyrics.page";
import lyricsRenderer from "./lyrics.renderer";
import type { TrackSearchInfo } from "./lyrics/types";

const SEEK_OFFSET_MS = 10;
/** Nudge UI ahead of getCurrentTime - YTM clock often trails audible audio. */
const DISPLAY_LEAD_MS = 80;

type LyricsLogger = { debug: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

interface LyricsRuntime {
	store: ReturnType<typeof createLyricsStore>;
	mount: TabMountHandle | null;
	renderer: LyricsRenderApi | null;
	unsubStore: (() => void) | null;
	unsubSettings: (() => void) | null;
	unsubTrackId: (() => void) | null;
	unsubTime: (() => void) | null;
	domUtils: Window["domUtils"] | null;
	log: LyricsLogger | null;
	onSettingsChange: ((fn: (key: string, value: any) => void) => () => void) | null;
	active: boolean;
	tabSelected: boolean;
	started: boolean;
	lastVideoId: string | null;
}

const runtime: LyricsRuntime = {
	store: createLyricsStore(),
	mount: null,
	renderer: null,
	unsubStore: null,
	unsubSettings: null,
	unsubTrackId: null,
	unsubTime: null,
	domUtils: null,
	log: null,
	onSettingsChange: null,
	active: false,
	tabSelected: false,
	started: false,
	lastVideoId: null,
};

function readLyricsSettings(settings?: Record<string, any>) {
	const s = settings ?? window.__ytd_settings ?? {};
	return {
		enabled: !!s?.lyrics?.enabled,
		showTimeCodes: !!s?.lyrics?.showTimeCodes,
		showEvenIfInexact: s?.lyrics?.showEvenIfInexact !== false,
		showProgressBar: s?.lyrics?.showProgressBar !== false,
		providers: s?.lyrics?.providers,
	};
}

/** Soft gate for queue prefetch (duration often missing on queue rows). */
function canPrefetchTrack(info: TrackSearchInfo | null | undefined): info is TrackSearchInfo {
	if (!info?.videoId || !info.title?.trim()) return false;
	if (!info.artist?.trim()) return false;
	if (info.isLiveContent) return false;
	const type = String(info.musicVideoType ?? "");
	if (type.includes("PODCAST") || type.includes("EPISODE")) return false;
	return true;
}

async function prefetchNextTrack(cfg: ReturnType<typeof readLyricsSettings>) {
	try {
		const next = await lyricsPage.request("nextTrackInfo");
		if (!canPrefetchTrack(next)) return;
		runtime.store.prefetchForTrack(next, {
			showEvenIfInexact: cfg.showEvenIfInexact,
			providers: cfg.providers,
		});
		runtime.log?.debug("lyrics: prefetch next", next.videoId, next.title);
	} catch (err) {
		runtime.log?.debug("lyrics: prefetch next failed", err);
	}
}

async function refreshTrack(expectVideoId?: string | null) {
	if (!runtime.active) return;
	const expected = expectVideoId ?? runtime.lastVideoId;
	// Cached track: show lyrics immediately; do not block UI on meta retry.
	const hadCache = expected ? runtime.store.applyCacheIfPresent(expected) : false;
	if (expected && !hadCache) runtime.store.setLoading(expected);

	const info = await trackInfoFromMainWorld({ expectVideoId: expected });
	if (!runtime.active) return;
	// Newer trackId:change won the race.
	if (expected && runtime.lastVideoId !== expected) return;

	const skip = shouldSkipTrack(info);
	if (skip || !info) {
		runtime.store.setSkipped(info?.videoId ?? expected ?? null, skip ?? "No track");
		return;
	}
	runtime.lastVideoId = info.videoId;
	const cfg = readLyricsSettings();
	await runtime.store.fetchForTrack(info, {
		showEvenIfInexact: cfg.showEvenIfInexact,
		providers: cfg.providers,
	});
	if (!runtime.active) return;
	if (runtime.lastVideoId !== info.videoId) return;
	void prefetchNextTrack(cfg);
}

function applyTickTime(timeSec: number) {
	if (!runtime.renderer || !runtime.active || !runtime.tabSelected) return;
	runtime.renderer.setTime(timeSec * 1000 + DISPLAY_LEAD_MS);
}

async function startTimePoll() {
	if (runtime.unsubTime) return;
	runtime.unsubTime = subscribeLyricsTime(applyTickTime);
	const ok = await startLyricsClock();
	if (!ok) {
		runtime.unsubTime();
		runtime.unsubTime = null;
		runtime.log?.debug("lyrics: startClock failed (page listen not ready?)");
	}
}

function stopTimePoll() {
	stopLyricsClock();
	runtime.unsubTime?.();
	runtime.unsubTime = null;
}

function unbindTrackWatch() {
	runtime.unsubTrackId?.();
	runtime.unsubTrackId = null;
}

function bindTrackWatch() {
	unbindTrackWatch();
	try {
		const ytmd = getYtmd();
		runtime.unsubTrackId = ytmd.onInternal("trackId:change", (id) => {
			const videoId = typeof id === "string" ? id : "";
			if (!videoId) {
				void refreshTrack(null);
				return;
			}
			runtime.lastVideoId = videoId;
			void refreshTrack(videoId);
		});
	} catch (err) {
		runtime.log?.error("lyrics: failed to bind trackId:change", err);
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
				void startTimePoll();
			} else {
				stopTimePoll();
			}
		},
	});
	runtime.tabSelected = runtime.mount.isLyricsTabSelected();

	runtime.renderer = createLyricsRenderer(() => runtime.mount?.getHost() ?? null, {
		showTimeCodes: () => readLyricsSettings().showTimeCodes,
		showProgressBar: () => readLyricsSettings().showProgressBar,
		onSeek: (timeMs) => {
			void seekPlayer((timeMs + SEEK_OFFSET_MS) / 1000).then((ok) => {
				if (!ok) runtime.log?.debug("lyrics: seek failed");
			});
		},
	});

	runtime.unsubStore = runtime.store.subscribe((snap) => runtime.renderer?.setSnapshot(snap));
	runtime.unsubSettings =
		runtime.onSettingsChange?.((key) => {
			if (key === "lyrics.showTimeCodes" || key === "lyrics.showProgressBar") {
				runtime.renderer?.repaint();
			}
			if (key === "lyrics.showEvenIfInexact" || key === "lyrics.providers") {
				runtime.store.clearCache();
				void refreshTrack();
			}
		}) ?? null;

	bindTrackWatch();
	if (runtime.tabSelected) await startTimePoll();
	await refreshTrack();
	runtime.renderer.repaint();
}

function stopLyrics() {
	if (!runtime.active && !runtime.mount) return;
	runtime.log?.debug("lyrics: stop");
	runtime.active = false;
	runtime.tabSelected = false;
	runtime.lastVideoId = null;
	stopTimePoll();
	unbindTrackWatch();
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
		displayName: "Lyrics",
	},
	{
		renderer: lyricsRenderer,
		async afterInit({ settings, domUtils, log, onSettingsChange }) {
			runtime.domUtils = domUtils;
			runtime.log = log;
			runtime.onSettingsChange = onSettingsChange;
			runtime.started = true;

			if (readLyricsSettings(settings).enabled) {
				await startLyrics();
			}
		},
		cmds: {
			async enable({ log, domUtils, onSettingsChange }) {
				log.debug("lyrics cmd enable");
				if (domUtils) runtime.domUtils = domUtils;
				if (onSettingsChange) runtime.onSettingsChange = onSettingsChange;
				await startLyrics();
			},
			async disable({ log }) {
				log.debug("lyrics cmd disable");
				stopLyrics();
			},
		},
	},
);
