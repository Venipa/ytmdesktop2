import { getYoutubeView } from "@main/lifecycle";
import type { Input, WebContents } from "electron";
import { screen } from "electron";

export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 1.5;
export const ZOOM_STEP = 0.05;
/** App chrome toolbar height — fixed; user zoom never scales it. */
export const TOOLBAR_HEIGHT = 40;

let currentZoomFactor = 1;
let youtubeWebContents: WebContents | null = null;
const lockedChromeWebContents = new WeakSet<WebContents>();
const boundYoutubeWebContents = new WeakSet<WebContents>();

/** Clamp + snap to 5% steps. */
export function clampZoomFactor(value: unknown): number {
	const raw = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(raw)) return 1;
	const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, raw));
	return Number((Math.round(clamped / ZOOM_STEP) * ZOOM_STEP).toFixed(2));
}

export function getZoomFactor(): number {
	return currentZoomFactor;
}

export function setZoomFactorState(factor: unknown): number {
	currentZoomFactor = clampZoomFactor(factor);
	return currentZoomFactor;
}

function resolveYoutubeWebContents(): WebContents | null {
	if (youtubeWebContents && !youtubeWebContents.isDestroyed()) return youtubeWebContents;
	const fromLifecycle = getYoutubeView()?.webContents;
	if (fromLifecycle && !fromLifecycle.isDestroyed()) {
		youtubeWebContents = fromLifecycle;
		return fromLifecycle;
	}
	return null;
}

/**
 * Force Chromium to accept the factor. Same-value setZoomFactor can no-op;
 * a tiny nudge then target value makes flaky applies reliable.
 */
export function applyZoomToWebContents(wc: WebContents | null | undefined, factor: number = currentZoomFactor): void {
	if (!wc || wc.isDestroyed()) return;
	const next = clampZoomFactor(factor);
	try {
		const current = wc.getZoomFactor();
		if (Math.abs(current - next) < 0.001) {
			wc.setZoomFactor(next > 1 ? next - 0.01 : next + 0.01);
		}
		wc.setZoomFactor(next);
		if (Math.abs(wc.getZoomFactor() - next) > 0.02) {
			const level = Math.log(next) / Math.log(1.2);
			wc.setZoomLevel(level);
		}
	} catch {
		/* destroyed mid-call */
	}
}

/** User zoom applies only to YouTube Music. App chrome stays 100% (OS DPI still applies). */
export function applyYoutubeZoom(factor?: unknown): number {
	const next = setZoomFactorState(factor ?? currentZoomFactor);
	applyZoomToWebContents(resolveYoutubeWebContents(), next);
	return next;
}

function isChromeZoomShortcut(input: Input): boolean {
	if (!(input.control || input.meta)) return false;
	if (input.type !== "keyDown" && input.type !== "rawKeyDown") return false;
	const key = input.key;
	const code = input.code;
	return (
		key === "+" ||
		key === "-" ||
		key === "=" ||
		key === "_" ||
		key === "0" ||
		key === "Add" ||
		key === "Subtract" ||
		key === "Equal" ||
		key === "Minus" ||
		key === "NumpadAdd" ||
		key === "NumpadSubtract" ||
		key === "Digit0" ||
		key === "Numpad0" ||
		code === "Equal" ||
		code === "Minus" ||
		code === "NumpadAdd" ||
		code === "NumpadSubtract" ||
		code === "Digit0" ||
		code === "Numpad0"
	);
}

function isCtrlWheelZoom(input: Input): boolean {
	if (!(input.control || input.meta)) return false;
	// Electron versions differ on wheel event type naming.
	return input.type === "mouseWheel" || input.type === ("wheel" as Input["type"]);
}

function assertYoutubeSettingZoom(wc: WebContents): void {
	if (wc.isDestroyed()) return;
	applyZoomToWebContents(wc, currentZoomFactor);
}

/**
 * Bind YouTube WC: apply setting zoom, re-apply after loads, block gesture zoom
 * so Ctrl+/- / pinch cannot drift away from Display setting.
 */
export function bindYoutubeWebContents(wc: WebContents | null | undefined): void {
	if (!wc || wc.isDestroyed()) return;
	youtubeWebContents = wc;
	wc.once("destroyed", () => {
		if (youtubeWebContents === wc) youtubeWebContents = null;
	});
	assertYoutubeSettingZoom(wc);

	if (boundYoutubeWebContents.has(wc)) return;
	boundYoutubeWebContents.add(wc);

	try {
		void wc.setVisualZoomLevelLimits(1, 1);
	} catch {
		/* ignore */
	}

	const reapply = () => assertYoutubeSettingZoom(wc);
	wc.on("did-finish-load", reapply);
	wc.on("dom-ready", reapply);
	wc.on("zoom-changed", reapply);
	wc.on("before-input-event", (event, input) => {
		if (!isChromeZoomShortcut(input) && !isCtrlWheelZoom(input)) return;
		event.preventDefault();
		reapply();
	});
}

export type LockAppChromeZoomOptions = {
	/** Min zoom factor (default 1). OS DPI / deviceScaleFactor still applies separately. */
	min?: number;
	/** Max zoom factor (default 1). */
	max?: number;
};

function zoomFactorToLevel(factor: number): number {
	return Math.log(Math.max(factor, 0.01)) / Math.log(1.2);
}

function clampChromeZoomFactor(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * App chrome stays at zoom factor 1 by default (no Ctrl+/- / pinch / ctrl+wheel).
 * OS display scaling (DPI / deviceScaleFactor) remains enabled — that is not page zoom.
 * Pass a min/max range later if chrome zoom is ever allowed.
 */
export function lockAppChromeZoom(wc: WebContents | null | undefined, options: LockAppChromeZoomOptions = {}): void {
	if (!wc || wc.isDestroyed()) return;
	const min = options.min ?? 1;
	const max = options.max ?? 1;
	const locked = Math.abs(min - max) < 0.001;
	const defaultFactor = clampChromeZoomFactor(1, min, max);

	const assertChromeZoom = () => {
		if (wc.isDestroyed()) return;
		const current = wc.getZoomFactor();
		const next = clampChromeZoomFactor(current, min, max);
		if (Math.abs(current - next) < 0.001 && (!locked || Math.abs(current - defaultFactor) < 0.001)) return;
		wc.setZoomFactor(locked ? defaultFactor : next);
	};

	try {
		wc.setZoomFactor(defaultFactor);
		if (locked) {
			void wc.setVisualZoomLevelLimits(1, 1);
		} else {
			void wc.setVisualZoomLevelLimits(zoomFactorToLevel(min), zoomFactorToLevel(max));
		}
	} catch {
		/* ignore */
	}

	if (lockedChromeWebContents.has(wc)) {
		assertChromeZoom();
		return;
	}
	lockedChromeWebContents.add(wc);

	wc.on("before-input-event", (event, input) => {
		if (locked && (isChromeZoomShortcut(input) || isCtrlWheelZoom(input))) {
			event.preventDefault();
			assertChromeZoom();
			return;
		}
		if (!locked && isCtrlWheelZoom(input)) {
			queueMicrotask(assertChromeZoom);
		}
	});

	wc.on("zoom-changed", () => {
		assertChromeZoom();
	});

	const onDisplayMetrics = () => {
		assertChromeZoom();
	};
	screen.on("display-metrics-changed", onDisplayMetrics);
	wc.once("destroyed", () => {
		screen.off("display-metrics-changed", onDisplayMetrics);
	});
}
