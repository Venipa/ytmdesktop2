import { AfterInit, BaseProvider, OnDestroy } from "@main/core/baseProvider";
import { isAppQuitting, shouldCancelWindowClose } from "@main/handlers/quitPolicy";
import { serverMain } from "@main/ipc/serverEvents";
import SettingsProvider from "@main/trpc/routers/settings/service";
import { createAppWindow, wrapWindowHandler } from "@main/windows/windowUtils";
import {
	EMPTY_LYRICS_OVERLAY_SNAPSHOT,
	LYRICS_OVERLAY_DEFAULT_SIZE,
	LYRICS_OVERLAY_EVENTS,
	LYRICS_OVERLAY_IPC,
	LYRICS_OVERLAY_MIN_SIZE,
	type LyricsOverlayClock,
	type LyricsOverlaySnapshot,
	type LyricsOverlayWindowState,
	readLyricsOverlaySettings,
} from "@shared/lyrics/overlay";
import { BrowserWindow, type Rectangle, screen } from "electron";
import { debounce } from "lodash-es";

/** Gap between the overlay's bottom edge and the taskbar when no saved position exists. */
const OVERLAY_BOTTOM_MARGIN = 48;

function isSnapshot(value: unknown): value is LyricsOverlaySnapshot {
	const v = value as LyricsOverlaySnapshot | null;
	return !!v && typeof v === "object" && typeof v.status === "string" && (v.lines === null || Array.isArray(v.lines));
}

function isClock(value: unknown): value is LyricsOverlayClock {
	const v = value as LyricsOverlayClock | null;
	return !!v && typeof v === "object" && typeof v.timeMs === "number" && typeof v.playing === "boolean" && typeof v.at === "number";
}

/** Keep a saved rectangle on-screen (display removed / resolution changed). */
function clampToWorkArea(bounds: Rectangle): Rectangle {
	const area = screen.getDisplayMatching(bounds).workArea;
	const width = Math.min(Math.max(bounds.width, LYRICS_OVERLAY_MIN_SIZE.width), area.width);
	const height = Math.min(Math.max(bounds.height, LYRICS_OVERLAY_MIN_SIZE.height), area.height);
	return {
		width,
		height,
		x: Math.round(Math.min(Math.max(bounds.x, area.x), area.x + area.width - width)),
		y: Math.round(Math.min(Math.max(bounds.y, area.y), area.y + area.height - height)),
	};
}

function bottomCenterBounds(width: number, height: number): Rectangle {
	const area = screen.getPrimaryDisplay().workArea;
	return {
		width,
		height,
		x: Math.round(area.x + (area.width - width) / 2),
		y: Math.round(area.y + area.height - height - OVERLAY_BOTTOM_MARGIN),
	};
}

/**
 * Hot-toggles the youtube `lyrics` plugin via settings → IPC cmds, and owns the desktop lyrics
 * overlay: an always-on-top transparent window fed by the plugin (snapshot + low-rate clock).
 */
export default class LyricsProvider extends BaseProvider implements AfterInit, OnDestroy {
	private _overlayWindow: BrowserWindow | undefined;
	private _overlayReady: Promise<BrowserWindow> | null = null;
	private _snapshot: LyricsOverlaySnapshot = EMPTY_LYRICS_OVERLAY_SNAPSHOT;
	private _clock: LyricsOverlayClock | null = null;
	private _saveOverlayBounds: (() => void) | null = null;
	private _settingsWired = false;
	private persistOverlayBounds = debounce(() => this._saveOverlayBounds?.(), 250);

	constructor() {
		super("lyrics");
		this.bindIpc();
	}

	get settingsInstance(): SettingsProvider {
		return this.getProvider("settings");
	}

	private bindIpc() {
		serverMain.on(LYRICS_OVERLAY_IPC.snapshot, (_ev: unknown, snap: unknown) => {
			if (!isSnapshot(snap)) return;
			this._snapshot = snap;
			serverMain.emit(LYRICS_OVERLAY_EVENTS.snapshot, snap);
		});
		serverMain.on(LYRICS_OVERLAY_IPC.clock, (_ev: unknown, clock: unknown) => {
			if (!isClock(clock)) return;
			this._clock = clock;
			serverMain.emit(LYRICS_OVERLAY_EVENTS.clock, clock);
		});
	}

	async AfterInit() {
		const settings = this.settingsInstance;
		if (!this._settingsWired) {
			this._settingsWired = true;
			settings.onSettingChange("lyrics.enabled", (value) => void this.__onToggle(value), {
				debounce: 300,
			});
			settings.onSettingChange("lyrics.overlay.enabled", (value) => {
				if (value) void this.openOverlay();
				else this.closeOverlay();
			});
			settings.onSettingChange("lyrics.overlay.locked", () => this.applyOverlayLock());
		}
		if (this.overlaySettings.enabled) {
			try {
				await this.openOverlay();
			} catch (err) {
				this.logger.error("lyrics overlay restore failed", err);
			}
		}
	}

	async OnDestroy() {
		this.persistOverlayBounds.cancel();
		const win = this.getOverlayWindow();
		if (win) {
			this._saveOverlayBounds?.();
			win.destroy();
		}
	}

	// ---- overlay feed -------------------------------------------------------------------------

	get overlaySettings() {
		return readLyricsOverlaySettings(this.settingsInstance.get("lyrics.overlay"));
	}

	getOverlaySnapshot(): LyricsOverlaySnapshot {
		return this._snapshot;
	}

	getOverlayClock(): LyricsOverlayClock | null {
		return this._clock;
	}

	getOverlayState(): LyricsOverlayWindowState {
		return { open: !!this.getOverlayWindow(), locked: this.overlaySettings.locked };
	}

	private emitOverlayState() {
		serverMain.emit(LYRICS_OVERLAY_EVENTS.state, this.getOverlayState());
	}

	// ---- overlay window -----------------------------------------------------------------------

	private getOverlayWindow(): BrowserWindow | null {
		const win = this._overlayWindow;
		if (!win || win.isDestroyed()) return null;
		return win;
	}

	/** Setting-driven entry points: the setting is the source of truth so tray / settings UI / window stay in sync. */
	setOverlayEnabled(enabled: boolean): boolean {
		this.settingsInstance.set("lyrics.overlay.enabled", enabled);
		this.settingsInstance.saveToDrive();
		return enabled;
	}

	toggleOverlay(): boolean {
		return this.setOverlayEnabled(!this.overlaySettings.enabled);
	}

	setOverlayLocked(locked: boolean): boolean {
		this.settingsInstance.set("lyrics.overlay.locked", locked);
		this.settingsInstance.saveToDrive();
		return locked;
	}

	toggleOverlayLocked(): boolean {
		return this.setOverlayLocked(!this.overlaySettings.locked);
	}

	/** Nudge the window back to the primary display's bottom centre (lost off-screen / multi-monitor changes). */
	resetOverlayPosition(): void {
		const win = this.getOverlayWindow();
		if (!win) return;
		const { width, height } = win.getBounds();
		win.setBounds(bottomCenterBounds(width, height));
		this.persistOverlayBounds();
	}

	async openOverlay(): Promise<void> {
		const win = await this.ensureOverlayWindow();
		if (win.isDestroyed()) return;
		if (!win.isVisible()) win.showInactive();
		this.applyOverlayLock(win);
		this.emitOverlayState();
	}

	closeOverlay(): void {
		this.persistOverlayBounds.cancel();
		const win = this.getOverlayWindow();
		if (!win) return;
		this._saveOverlayBounds?.();
		this._saveOverlayBounds = null;
		win.destroy();
		this._overlayWindow = undefined;
		this.emitOverlayState();
	}

	/**
	 * Locked = click-through, unfocusable, frozen bounds — the QQ Music style "pin it and forget it".
	 * Unlocked = movable (drag bar in the page) and resizable via the native frameless borders.
	 */
	private applyOverlayLock(win: BrowserWindow | null = this.getOverlayWindow()) {
		if (!win || win.isDestroyed()) return;
		const { locked } = this.overlaySettings;
		try {
			if (locked) win.setIgnoreMouseEvents(true);
			else win.setIgnoreMouseEvents(false);
			win.setResizable(!locked);
			win.setMovable(!locked);
			win.setFocusable(!locked);
			if (locked && win.isFocused()) win.blur();
		} catch (err) {
			this.logger.warn("lyrics overlay lock flags failed", err);
		}
		this.emitOverlayState();
	}

	private async ensureOverlayWindow(): Promise<BrowserWindow> {
		const existing = this.getOverlayWindow();
		if (existing) return existing;
		if (this._overlayReady) return this._overlayReady;

		this._overlayReady = (async () => {
			const win = await createAppWindow({
				path: "/lyrics-overlay",
				width: LYRICS_OVERLAY_DEFAULT_SIZE.width,
				height: LYRICS_OVERLAY_DEFAULT_SIZE.height,
				minWidth: LYRICS_OVERLAY_MIN_SIZE.width,
				minHeight: LYRICS_OVERLAY_MIN_SIZE.height,
				show: false,
				showTaskBar: false,
				minimizeable: false,
				maximizeable: false,
				devtools: false,
				transparent: true,
				extraOptions: {
					title: "Lyrics",
					alwaysOnTop: true,
					fullscreenable: false,
					webPreferences: { backgroundThrottling: false },
				},
			});
			// "screen-saver" is the highest macOS level; on Windows every level maps to HWND_TOPMOST.
			win.setAlwaysOnTop(true, "screen-saver");
			win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
			win.setMenuBarVisibility(false);
			win.webContents.setBackgroundThrottling(false);

			const { state, saveState, restored } = await wrapWindowHandler(win, "lyrics-overlay", {
				width: LYRICS_OVERLAY_DEFAULT_SIZE.width,
				height: LYRICS_OVERLAY_DEFAULT_SIZE.height,
			});
			this._saveOverlayBounds = saveState;
			if (restored && typeof state?.x === "number" && typeof state?.y === "number") {
				win.setBounds(clampToWorkArea({ x: state.x, y: state.y, width: state.width, height: state.height }));
			} else {
				win.setBounds(bottomCenterBounds(LYRICS_OVERLAY_DEFAULT_SIZE.width, LYRICS_OVERLAY_DEFAULT_SIZE.height));
			}
			win.on("moved", () => this.persistOverlayBounds());
			win.on("resized", () => this.persistOverlayBounds());

			// Alt+F4 / window close → treat as "turn the overlay off" instead of leaving the setting stale.
			win.on("close", (ev) => {
				if (!shouldCancelWindowClose({ quitting: isAppQuitting() })) return;
				ev.preventDefault();
				// Destroying from inside our own `close` handler is fragile — flip the setting on the next tick.
				setImmediate(() => this.setOverlayEnabled(false));
			});
			win.on("closed", () => {
				if (this._overlayWindow === win) this._overlayWindow = undefined;
				this.emitOverlayState();
			});

			this._overlayWindow = win;
			return win;
		})();

		try {
			return await this._overlayReady;
		} catch (err) {
			this._overlayWindow = undefined;
			throw err;
		} finally {
			this._overlayReady = null;
		}
	}

	// ---- plugin toggle ------------------------------------------------------------------------

	private async __onToggle(value: unknown) {
		if (value) await this.enable();
		else await this.disable();
	}

	private async enable() {
		this.logger.debug("Enabling lyrics");
		try {
			await this.isYtmReady();
		} catch (err) {
			this.logger.warn("ytm not fully ready, enabling lyrics anyway", err);
		}
		await this.executeCommand("enable");
	}

	private async disable() {
		this.logger.debug("Disabling lyrics");
		try {
			await this.isYtmReady();
		} catch (err) {
			this.logger.warn("ytm not fully ready, disabling lyrics anyway", err);
		}
		await this.executeCommand("disable");
	}
}
