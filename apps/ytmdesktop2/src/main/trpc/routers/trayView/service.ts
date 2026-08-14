import { platform } from "@electron-toolkit/utils";
import { AfterInit, BaseProvider, OnDestroy } from "@main/core/baseProvider";
import { isAppQuitting, shouldCancelWindowClose } from "@main/handlers/quitPolicy";
import { showOnActiveDesktop } from "@main/domain/showOnActiveDesktop";
import { positionNearTray } from "@main/domain/trayPosition";
import SettingsProvider from "@main/trpc/routers/settings/service";
import TrayProvider from "@main/trpc/routers/tray/service";
import { createAppWindow, wrapWindowHandler } from "@main/windows/windowUtils";
import { App, BrowserWindow, screen } from "electron";
import { debounce } from "lodash-es";

const TRAY_VIEW_WIDTH = 420;
const TRAY_VIEW_HEIGHT = 168;

function clampToVisibleWorkArea(x: number, y: number): { x: number; y: number } {
	const b = screen.getDisplayNearestPoint({ x, y }).workArea;
	return {
		x: Math.round(Math.min(Math.max(x, b.x), b.x + b.width - TRAY_VIEW_WIDTH)),
		y: Math.round(Math.min(Math.max(y, b.y), b.y + b.height - TRAY_VIEW_HEIGHT)),
	};
}

export default class TrayViewProvider extends BaseProvider implements AfterInit, OnDestroy {
	private _ready: Promise<BrowserWindow> | null = null;
	private _blurHiddenAt = 0;
	private _suppressBlurUntil = 0;
	private _pinned = false;
	private _saveWindowState: (() => void) | null = null;
	private _restoredBounds: { x: number; y: number } | null = null;
	private persistMoved = debounce(() => this._saveWindowState?.(), 250);
	private _settingsWired = false;

	constructor(_app: App) {
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
				this.setPinned(pinned, false);
			});
		}
		void this.tryRestorePinned();
	}

	private async tryRestorePinned() {
		this._pinned = !!this.settings.get("trayView.pinned", false);
		if (!this._pinned) return;
		const existing = this.getWindow();
		if (existing?.isVisible()) return;
		try {
			this.revealPinned(await this.ensureWindow());
		} catch (err) {
			this.logger.error("trayView restore failed", err);
		}
	}

	/** Do not hide() before first show — skipTaskbar HWND never maps. */
	private revealPinned(win: BrowserWindow) {
		if (!this._pinned || win.isDestroyed()) return;
		this.persistMoved.cancel();
		this.restorePosition(win);
		this.suppressBlur(2000);
		this.applyPinFlags(win);
		if (win.isMinimized()) win.restore();
		win.show();
		win.moveTop();
		this.restorePosition(win);
		this.emitState(true);
	}

	private getWindow(): BrowserWindow | null {
		const win = this.windowContext.views.trayViewWindow;
		if (!win || win.isDestroyed()) return null;
		return win;
	}

	private suppressBlur(ms = 300) {
		this._suppressBlurUntil = Date.now() + ms;
	}

	private dockToTray(win: BrowserWindow) {
		const tray = this.trayProvider?.Tray;
		positionNearTray(win, tray && !tray.isDestroyed() ? tray : null, {
			width: TRAY_VIEW_WIDTH,
			height: TRAY_VIEW_HEIGHT,
		});
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
			}

			this.applyPinFlags(win);
			win.on("move", () => this.persistMoved());
			win.on("moved", () => this.persistMoved());

			const dismiss = () => {
				if (this._pinned) return;
				win.hide();
				this.emitState(false);
			};

			win.on("close", (ev) => {
				if (!shouldCancelWindowClose({ quitting: isAppQuitting() })) return;
				ev.preventDefault();
				dismiss();
			});
			win.on("blur", () => {
				if (win.isDestroyed() || !win.isVisible()) return;
				if (this._pinned) return;
				if (Date.now() < this._suppressBlurUntil) return;
				this._blurHiddenAt = Date.now();
				dismiss();
			});
			win.webContents.on("before-input-event", (_ev, input) => {
				if (input.type === "keyDown" && input.key === "Escape") dismiss();
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
		win.setMovable(this._pinned);
		if (this._pinned) {
			win.setAlwaysOnTop(true, "floating");
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
	}

	setPinned(pinned: boolean, persist = true): boolean {
		this._pinned = pinned;
		if (persist) this.settings.set("trayView.pinned", pinned);
		const win = this.getWindow();
		if (win) {
			this.applyPinFlags(win);
			if (!this._pinned) this.dockToTray(win);
			else this._saveWindowState?.();
		}
		this.emitState(win?.isVisible() ?? false);
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
		if (!this._restoredBounds) {
			this.dockToTray(win);
			return;
		}
		const pos = clampToVisibleWorkArea(this._restoredBounds.x, this._restoredBounds.y);
		this._restoredBounds = pos;
		win.setPosition(pos.x, pos.y);
	}

	private present(win: BrowserWindow) {
		if (this._pinned) {
			this.revealPinned(win);
			return;
		}
		this.dockToTray(win);
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
			this.revealPinned(win);
			win.focus();
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
