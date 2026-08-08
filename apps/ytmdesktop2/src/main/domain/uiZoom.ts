import { getYoutubeView } from "@main/lifecycle";
import type { WebContents } from "electron";

export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 1.5;
export const ZOOM_STEP = 0.05;
/** App chrome toolbar height — fixed; user zoom never scales it. */
export const TOOLBAR_HEIGHT = 40;

let currentZoomFactor = 1;
let youtubeWebContents: WebContents | null = null;

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

/** Keep a live handle so zoom still applies when lifecycle lookup is stale. */
export function bindYoutubeWebContents(wc: WebContents | null | undefined): void {
	if (!wc || wc.isDestroyed()) return;
	youtubeWebContents = wc;
	wc.once("destroyed", () => {
		if (youtubeWebContents === wc) youtubeWebContents = null;
	});
	applyZoomToWebContents(wc, currentZoomFactor);
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
		// Verify — if Chromium rounded away, retry once via zoom level.
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
