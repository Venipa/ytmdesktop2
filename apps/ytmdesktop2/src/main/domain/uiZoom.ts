import { getYoutubeView } from "@main/lifecycle";
import type { WebContents } from "electron";

export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 1.5;
export const ZOOM_STEP = 0.05;
/** App chrome toolbar height — fixed; user zoom never scales it. */
export const TOOLBAR_HEIGHT = 40;

let currentZoomFactor = 1;

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

export function applyZoomToWebContents(wc: WebContents | null | undefined, factor: number = currentZoomFactor): void {
	if (!wc || wc.isDestroyed()) return;
	try {
		wc.setZoomFactor(clampZoomFactor(factor));
	} catch {
		/* destroyed mid-call */
	}
}

/** User zoom applies only to YouTube Music. App chrome stays 100% (OS DPI still applies). */
export function applyYoutubeZoom(factor?: unknown): number {
	const next = setZoomFactorState(factor ?? currentZoomFactor);
	applyZoomToWebContents(getYoutubeView()?.webContents, next);
	return next;
}
