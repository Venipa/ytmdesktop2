import { platform } from "@electron-toolkit/utils";
import { AfterInit, BaseProvider, OnDestroy } from "@main/core/baseProvider";
import { showOnActiveDesktop } from "@main/domain/showOnActiveDesktop";
import { positionNearTray } from "@main/domain/trayPosition";
import TrayProvider from "@main/trpc/routers/tray/service";
import { createAppWindow } from "@main/windows/windowUtils";
import { App, BrowserWindow } from "electron";

const TRAY_VIEW_WIDTH = 420;
const TRAY_VIEW_HEIGHT = 168;

export default class TrayViewProvider extends BaseProvider implements AfterInit, OnDestroy {
	private _ready: Promise<BrowserWindow> | null = null;
	/** Suppress reopen when tray click causes blur→hide then click→toggle. */
	private _blurHiddenAt = 0;
	/** Ignore blur while showOnActiveDesktop toggles visibility. */
	private _suppressBlurUntil = 0;
	/** Pinned: movable, always on top, click-away does not hide. */
	private _pinned = false;

	constructor(private app: App) {
		super("trayView");
	}

	async AfterInit() {
		void this.ensureWindow().catch((err) => this.logger.error("trayView pre-warm failed", err));
	}

	private get trayProvider(): TrayProvider {
		return this.getProvider("tray");
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
				// Detached DevTools steals focus → blur closes the popup instantly.
				devtools: false,
				// macOS panel → MoveToActiveSpace-friendly tray popup behavior.
				...(platform.isMacOS ? { type: "panel" as const } : {}),
			});

			win.setResizable(false);
			win.setMinimizable(false);
			win.setMaximizable(false);
			win.webContents.setBackgroundThrottling(false);
			this.applyPinFlags(win);

			win.on("close", (ev) => {
				ev.preventDefault();
				win.hide();
				this.emitState(false);
			});

			// Outside click / focus loss closes popup unless pinned.
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
			// Drop always-on-top first so Windows actually leaves the floating level.
			win.setAlwaysOnTop(false);
			if (this._pinned) {
				win.setAlwaysOnTop(true, "floating");
				win.setVisibleOnAllWorkspaces(true, {
					visibleOnFullScreen: true,
					skipTransformProcessType: true,
				});
			} else {
				win.setVisibleOnAllWorkspaces(false);
				win.setAlwaysOnTop(true, "pop-up-menu");
			}
		} catch (err) {
			this.logger.error("applyPinFlags failed", err);
		}
	}

	setPinned(pinned: boolean): boolean {
		this._pinned = pinned;
		const win = this.getWindow();
		if (win) {
			this.applyPinFlags(win);
			if (!this._pinned) this.position(win);
		}
		this.emitState(win?.isVisible() ?? false);
		return this._pinned;
	}

	togglePinned(): boolean {
		return this.setPinned(!this._pinned);
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

	/** Close tray popup and restore main window. */
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
		const win = this.getWindow();
		if (!win) return;
		win.removeAllListeners("close");
		win.removeAllListeners("blur");
		win.destroy();
		this.windowContext.views.trayViewWindow = undefined;
	}
}
