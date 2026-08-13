import { platform } from "@electron-toolkit/utils";
import { AfterInit, BaseProvider, OnDestroy } from "@main/core/baseProvider";
import { showOnActiveDesktop } from "@main/domain/showOnActiveDesktop";
import { positionNearTray } from "@main/domain/trayPosition";
import SettingsProvider from "@main/trpc/routers/settings/service";
import TrayProvider from "@main/trpc/routers/tray/service";
import { createAppWindow, wrapWindowHandler } from "@main/windows/windowUtils";
import { App, BrowserWindow, screen } from "electron";
import { existsSync, readFileSync } from "fs";
import { debounce } from "lodash-es";
import { join } from "path";
import { parse as parseYaml } from "yaml";

const TRAY_VIEW_WIDTH = 420;
const TRAY_VIEW_HEIGHT = 168;

function clampToVisibleWorkArea(x: number, y: number): { x: number; y: number } {
	const display = screen.getDisplayNearestPoint({ x, y });
	const b = display.workArea;
	return {
		x: Math.round(Math.min(Math.max(x, b.x), b.x + b.width - TRAY_VIEW_WIDTH)),
		y: Math.round(Math.min(Math.max(y, b.y), b.y + b.height - TRAY_VIEW_HEIGHT)),
	};
}
function readLegacyTrayBounds(app: App): { x: number; y: number } | null {
	try {
		const file = join(app.getPath("userData"), "tray-view.yml");
		if (!existsSync(file)) return null;
		const data = parseYaml(readFileSync(file, "utf8")) as { x?: number; y?: number };
		if (typeof data?.x === "number" && typeof data?.y === "number") return { x: data.x, y: data.y };
	} catch {
		/* ignore */
	}
	return null;
}

export default class TrayViewProvider extends BaseProvider implements AfterInit, OnDestroy {
	private _ready: Promise<BrowserWindow> | null = null;
	/** Suppress reopen when tray click causes blur→hide then click→toggle. */
	private _blurHiddenAt = 0;
	/** Ignore blur while showOnActiveDesktop toggles visibility. */
	private _suppressBlurUntil = 0;
	private _pinned = false;
	private _saveWindowState: (() => void) | null = null;
	private _restoredBounds: { x: number; y: number } | null = null;
	private persistMoved = debounce(() => this._saveWindowState?.(), 250);

	private _settingsWired = false;

	constructor(private app: App) {
		super("trayView");
	}

	private get settings(): SettingsProvider {
		return this.getProvider("settings");
	}

	private get trayProvider(): TrayProvider {
		return this.getProvider("tray");
	}

	async AfterInit() {
		this._pinned = !!this.settings.get("trayView.pinned", false);
		if (!this._settingsWired) {
			this._settingsWired = true;
			this.settings.onSettingChange("trayView.pinned", (value) => {
				const pinned = !!value;
				if (pinned === this._pinned) return;
				this.applyPinned(pinned, { persist: false });
			});
		}
		void this.tryRestorePinned();
		setTimeout(() => void this.tryRestorePinned(), 600);
	}

	private async tryRestorePinned() {
		this._pinned = !!this.settings.get("trayView.pinned", false);
		this.logger.debug("tryRestorePinned", { pinned: this._pinned });
		if (!this._pinned) return;
		try {
			const win = await this.ensureWindow();
			this.revealPinned(win);
		} catch (err) {
			this.logger.error("trayView restore failed", err);
		}
	}

	/** First paint must not hide(). skipTaskbar + hide after first show leaves HWND unmapped. */
	private revealPinned(win: BrowserWindow) {
		if (!this._pinned || win.isDestroyed()) return;
		this.persistMoved.cancel();
		this.restorePosition(win);
		this.suppressBlur(2000);
		this.applyPinFlags(win);
		if (win.isMinimized()) win.restore();
		win.show();
		win.setAlwaysOnTop(true, "screen-saver");
		win.moveTop();
		this.restorePosition(win);
		this.emitState(true);
		this.logger.debug("trayView revealed", { bounds: win.getBounds(), visible: win.isVisible() });
	}

	private getWindow(): BrowserWindow | null {
		const win = this.windowContext.views.trayViewWindow;
		if (!win || win.isDestroyed()) return null;
		return win;
	}

	private suppressBlur(ms = 300) {
		this._suppressBlurUntil = Date.now() + ms;
	}

	private async ensureWindow(): Promise<BrowserWindow> {
		const existing = this.getWindow();
		if (existing) return existing;
		if (this._ready) return this._ready;

		this._ready = (async () => {
			const win = await createAppWindow({
				path: "/trayview",
				width: TRAY_VIEW_WIDTH,
				height: TRAY_VIEW_HEIGHT,
				minWidth: TRAY_VIEW_WIDTH,
				minHeight: TRAY_VIEW_HEIGHT,
				maxWidth: TRAY_VIEW_WIDTH,
				maxHeight: TRAY_VIEW_HEIGHT,
				show: false,
				showTaskBar: false,
				minimizeable: false,
				maximizeable: false,
				devtools: false,
				...(platform.isMacOS ? { type: "panel" as const } : {}),
			});

			win.setResizable(false);
			win.setMinimizable(false);
			win.setMaximizable(false);
			win.webContents.setBackgroundThrottling(false);

			const { state, saveState, restored } = await wrapWindowHandler(win, "trayview", {
				width: TRAY_VIEW_WIDTH,
				height: TRAY_VIEW_HEIGHT,
				persist: () => this._pinned,
			});
			this._saveWindowState = saveState;
			if (restored && typeof state?.x === "number" && typeof state?.y === "number") {
				this._restoredBounds = { x: state.x, y: state.y };
			} else {
				this._restoredBounds = readLegacyTrayBounds(this.app);
			}

			this.applyPinFlags(win);
			win.on("move", () => this.persistMoved());
			win.on("moved", () => this.persistMoved());

			win.on("close", (ev) => {
				ev.preventDefault();
				if (this._pinned) return;
				win.hide();
				this.emitState(false);
			});

			win.on("blur", () => {
				if (win.isDestroyed() || !win.isVisible()) return;
				if (this._pinned) return;
				if (Date.now() < this._suppressBlurUntil) return;
				win.hide();
				this._blurHiddenAt = Date.now();
				this.emitState(false);
			});

			win.webContents.on("before-input-event", (_ev, input) => {
				if (input.type === "keyDown" && input.key === "Escape") {
					if (this._pinned) return;
					win.hide();
					this.emitState(false);
				}
			});

			this.windowContext.views.trayViewWindow = win;
			return win;
		})();

		try {
			return await this._ready;
		} catch (err) {
			this.windowContext.views.trayViewWindow = undefined;
			throw err;
		} finally {
			this._ready = null;
		}
	}

	private emitState(active: boolean) {
		this.windowContext.sendToAllViews("trayview.state", { active, pinned: this._pinned });
	}

	private applyPinFlags(win: BrowserWindow) {
		if (win.isDestroyed()) return;
		this.suppressBlur(400);
		try {
			win.setMovable(this._pinned);
			if (this._pinned) {
				win.setAlwaysOnTop(true, "screen-saver");
				win.setSkipTaskbar(false);
				win.setVisibleOnAllWorkspaces(true, {
					visibleOnFullScreen: true,
					skipTransformProcessType: true,
				});
			} else {
				win.setSkipTaskbar(true);
				win.setVisibleOnAllWorkspaces(false);
				win.setAlwaysOnTop(true, "pop-up-menu");
			}
		} catch (err) {
			this.logger.error("applyPinFlags failed", err);
		}
	}

	private applyPinned(pinned: boolean, options?: { persist?: boolean }) {
		this._pinned = pinned;
		if (options?.persist !== false) this.settings.set("trayView.pinned", pinned);
		const win = this.getWindow();
		if (win) {
			this.applyPinFlags(win);
			if (!this._pinned) this.position(win);
			else this._saveWindowState?.();
		}
		this.emitState(win?.isVisible() ?? false);
	}

	setPinned(pinned: boolean): boolean {
		this.applyPinned(pinned);
		return this._pinned;
	}

	togglePinned(): boolean {
		return this.setPinned(!this._pinned);
	}

	isPinned(): boolean {
		return this._pinned;
	}

	private restorePosition(win: BrowserWindow) {
		if (win.isDestroyed()) return;
		if (this._restoredBounds) {
			const pos = clampToVisibleWorkArea(this._restoredBounds.x, this._restoredBounds.y);
			this._restoredBounds = pos;
			win.setPosition(pos.x, pos.y);
			return;
		}
		const tray = this.trayProvider?.Tray;
		positionNearTray(win, tray && !tray.isDestroyed() ? tray : null, {
			width: TRAY_VIEW_WIDTH,
			height: TRAY_VIEW_HEIGHT,
		});
	}

	private position(win: BrowserWindow) {
		if (this._pinned) return;
		const tray = this.trayProvider?.Tray;
		positionNearTray(win, tray && !tray.isDestroyed() ? tray : null, {
			width: TRAY_VIEW_WIDTH,
			height: TRAY_VIEW_HEIGHT,
		});
	}

	private present(win: BrowserWindow) {
		if (this._pinned) {
			this.revealPinned(win);
			return;
		}
		this.position(win);
		showOnActiveDesktop(win, { suppressBlur: (ms) => this.suppressBlur(ms) });
		if (!win.isDestroyed()) {
			this.applyPinFlags(win);
			win.moveTop();
		}
	}

	async open(): Promise<number> {
		const win = await this.ensureWindow();
		this.present(win);
		this.emitState(true);
		return win.id;
	}

	async hide(): Promise<void> {
		if (this._pinned) return;
		const win = this.getWindow();
		if (!win) return;
		if (win.isVisible()) win.hide();
		this.emitState(false);
	}

	async openMain(): Promise<void> {
		await this.hide();
		const main = this.windowContext.main;
		if (!main || main.isDestroyed()) return;
		if (!main.isVisible()) main.show();
		main.setSkipTaskbar(false);
		if (main.isMinimized()) main.restore();
		main.focus();
		main.moveTop();
	}

	async toggle(): Promise<number | null> {
		const win = await this.ensureWindow();
		if (this._pinned) {
			if (!win.isVisible()) {
				this.present(win);
				this.restorePosition(win);
			}
			this.suppressBlur(400);
			if (!win.isDestroyed()) {
				win.show();
				win.focus();
				win.moveTop();
			}
			this.emitState(true);
			return win.id;
		}
		const blurJustHid = Date.now() - this._blurHiddenAt < 400;
		if (win.isVisible() || blurJustHid) {
			if (win.isVisible()) win.hide();
			this._blurHiddenAt = 0;
			this.emitState(false);
			return null;
		}
		this.present(win);
		this.emitState(true);
		return win.id;
	}

	async OnDestroy() {
		this.persistMoved.cancel();
		this._saveWindowState?.();
		const win = this.getWindow();
		if (!win) return;
		win.removeAllListeners("close");
		win.removeAllListeners("blur");
		win.removeAllListeners("move");
		win.removeAllListeners("moved");
		win.destroy();
		this.windowContext.views.trayViewWindow = undefined;
	}
}
