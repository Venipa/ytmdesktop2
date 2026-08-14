let quitting = false;

export function isAppQuitting(): boolean {
	return quitting;
}

export function markAppQuitting(): void {
	quitting = true;
}

/** True = preventDefault on BrowserWindow `close` / `before-quit`. */
export function shouldCancelWindowClose(opts: { quitting: boolean; hideToTray?: boolean }): boolean {
	if (opts.quitting) return false;
	return true;
}
