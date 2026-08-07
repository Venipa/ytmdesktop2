import { BrowserWindow } from "electron";

export interface ShowOnActiveDesktopOptions {
	/** Called around visibility toggles that would otherwise fire spurious `blur` handlers. */
	suppressBlur?: (ms?: number) => void;
}

/**
 * Show a window on the user's *current* virtual desktop / Space / workspace.
 *
 * Pre-warmed hidden windows stick to the desktop where they were first shown.
 * Electron has no direct "move to active desktop" API on all OSes, so we use
 * the usual pin → show/focus → unpin (or Win skipTaskbar) dance.
 */
export function showOnActiveDesktop(win: BrowserWindow, options?: ShowOnActiveDesktopOptions): void {
	if (!win || win.isDestroyed()) return;

	const suppressBlur = options?.suppressBlur;

	if (process.platform === "darwin" || process.platform === "linux") {
		suppressBlur?.(300);
		try {
			// Join all workspaces briefly so show/focus attaches to the active one,
			// then leave so the popup does not linger on every desktop.
			win.setVisibleOnAllWorkspaces(true, {
				visibleOnFullScreen: true,
				// Avoid macOS dock/process-type flicker on every open.
				skipTransformProcessType: true,
			});
			win.show();
			win.focus();
			win.moveTop();
		} finally {
			if (!win.isDestroyed()) win.setVisibleOnAllWorkspaces(false);
		}
		return;
	}

	// Windows: setVisibleOnAllWorkspaces is a no-op. A hide→show cycle while
	// skipTaskbar re-affiliates the HWND with the current virtual desktop.
	// Even when already hidden, a brief show→hide→show is required to move affinity.
	suppressBlur?.(400);
	win.setSkipTaskbar(true);
	try {
		if (win.isVisible()) {
			win.hide();
			win.show();
		} else {
			win.show();
			win.hide();
			win.show();
		}
		win.focus();
		win.moveTop();
	} catch {
		if (!win.isDestroyed()) {
			win.show();
			win.focus();
			win.moveTop();
		}
	}
}
