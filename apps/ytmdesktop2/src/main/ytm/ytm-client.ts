import { createSendHandler } from "@main/ipc/ipc";
import { getYoutubeView } from "@main/lifecycle";
import { buildYtmReadyPollScript, pluginCmdChannel, type YtmCmdTarget, type YtmPushEvent } from "@shared/ytm";
import type { WebContentsView } from "electron";

function requireYoutubeView(action: string): WebContentsView {
	const view = getYoutubeView();
	if (!view || view.webContents.isDestroyed()) {
		throw new Error(`YtmClient: youtube view not ready for ${action}`);
	}
	return view;
}

export type YtmReadyOptions = {
	timeout?: number;
	/** When false, only page `isYTMLoaded`. Default true. */
	requirePlayer?: boolean;
	/** When false, skip `isYTMLoaded` (boot player wait). Default true. */
	requireLoaded?: boolean;
};

/**
 * Stable main -> youtube plugin surface.
 * Services use this instead of raw `plugins:…` channel strings.
 */
export const YtmClient = {
	async cmd<T = unknown>(target: YtmCmdTarget, command: string, ...args: unknown[]): Promise<T> {
		const view = requireYoutubeView(`cmd ${target}.${command}`);
		const channel = pluginCmdChannel(target, command);
		return createSendHandler<T>(view, channel)(...args);
	},

	async cmdTimed<T = unknown>(target: YtmCmdTarget, command: string, timeoutMs: number, ...args: unknown[]): Promise<T> {
		const view = requireYoutubeView(`cmd ${target}.${command}`);
		const channel = pluginCmdChannel(target, command);
		return createSendHandler<T>(view, channel, { timeout: timeoutMs })(...args);
	},

	push(channel: YtmPushEvent, ...args: unknown[]): void {
		const view = getYoutubeView();
		if (!view || view.webContents.isDestroyed()) return;
		view.webContents.send(channel, ...args);
	},

	/**
	 * Old-style executeJavaScript, one roundtrip: page polls until ready or timeout.
	 */
	async isReady(options: YtmReadyOptions = {}): Promise<boolean> {
		const view = getYoutubeView();
		if (!view || view.webContents.isDestroyed() || view.webContents.isCrashed()) return false;
		if (view.webContents.isLoading()) {
			await new Promise<void>((resolve) => {
				view.webContents.once("did-finish-load", () => resolve());
			});
		}
		const timeoutMs = options.timeout ?? 12_000;
		const script = buildYtmReadyPollScript({
			timeoutMs,
			requirePlayer: options.requirePlayer !== false,
			requireLoaded: options.requireLoaded !== false,
			intervalMs: 50,
		});
		try {
			return !!(await view.webContents.executeJavaScript(script));
		} catch {
			return false;
		}
	},
};
