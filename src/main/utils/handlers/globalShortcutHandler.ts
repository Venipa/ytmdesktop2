import { BrowserWindowViews } from "@main/utils/mappedWindow";
import { ServiceCollection } from "@main/utils/providerCollection";
import logger from "@shared/utils/Logger";
import { globalShortcut, WebContents } from "electron";

const log = logger.child("globalShortcut");

const SHORTCUT_TIMEOUT_MS = 2000;
const SHORTCUT_DEBOUNCE_MS = 300;
const registeredShortcuts = new Set<string>();
const lastExecutionTime = new Map<string, number>();

async function executeWithTimeout<T>(webContents: WebContents, script: string, userGesture: boolean = true): Promise<T | null> {
	return Promise.race([
		webContents.executeJavaScript(script, userGesture) as Promise<T>,
		new Promise<null>((resolve) => setTimeout(() => resolve(null), SHORTCUT_TIMEOUT_MS)),
	]).catch((error) => {
		log.debug(`JS execution timeout/error`, error);
		return null;
	});
}

const CLICK_FALLBACK_SCRIPT = {
	next: `(() => {
		const selectors = [
			'tp-yt-paper-icon-button.next-button',
			'tp-yt-paper-icon-button[title*="Next"]',
			'tp-yt-paper-icon-button[aria-label*="Next"]',
			'ytmusic-player-bar #right-controls tp-yt-paper-icon-button.next-button',
			'ytmusic-player-bar #right-controls tp-yt-paper-icon-button:last-of-type'
		];
		for (const selector of selectors) {
			const button = document.querySelector(selector);
			if (button && typeof button.click === 'function') {
				button.click();
				return 'clicked';
			}
		}
		return 'not-found';
	})()`,
	previous: `(() => {
		const selectors = [
			'tp-yt-paper-icon-button.previous-button',
			'tp-yt-paper-icon-button[title*="Previous"]',
			'tp-yt-paper-icon-button[aria-label*="Previous"]',
			'ytmusic-player-bar #left-controls tp-yt-paper-icon-button.previous-button',
			'ytmusic-player-bar #left-controls tp-yt-paper-icon-button'
		];
		for (const selector of selectors) {
			const button = document.querySelector(selector);
			if (button && typeof button.click === 'function') {
				button.click();
				return 'clicked';
			}
		}
		return 'not-found';
	})()`,
} as const;

const KEYBOARD_FALLBACK_SCRIPT = {
	next: `(() => {
		const key = 'ArrowRight';
		document.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
		document.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true, cancelable: true }));
		window.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
		window.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true, cancelable: true }));
		return 'keyboard';
	})()`,
	previous: `(() => {
		const key = 'ArrowLeft';
		document.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
		document.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true, cancelable: true }));
		window.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
		window.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true, cancelable: true }));
		return 'keyboard';
	})()`,
} as const;

type TrackAction = "next" | "previous";

async function runFallback(webContents: WebContents, action: TrackAction) {
	if (webContents.isDestroyed()) return;

	try {
		const clickResult = await executeWithTimeout<string>(webContents, CLICK_FALLBACK_SCRIPT[action], true);
		if (clickResult === "clicked") return;
	} catch (error) {
		log.warn(`DOM fallback failed for ${action}`, error);
	}

	try {
		await executeWithTimeout(webContents, KEYBOARD_FALLBACK_SCRIPT[action], true);
	} catch (error) {
		log.warn(`Keyboard fallback failed for ${action}`, error);
	}
}

export function attachGlobalShortcutHandler(mainWindow: BrowserWindowViews<any, any>, serviceCollection: ServiceCollection) {
	const apiProvider = serviceCollection.getTypedProvider("api");

	const getYoutubeWebContents = () => {
		const youtubeView = mainWindow.views?.youtubeView;
		if (!youtubeView?.webContents || youtubeView.webContents.isDestroyed()) return null;
		return youtubeView.webContents;
	};

	const trigger = async (action: TrackAction) => {
		const now = Date.now();
		const lastExec = lastExecutionTime.get(action) ?? 0;

		if (now - lastExec < SHORTCUT_DEBOUNCE_MS) {
			log.debug(`Shortcut ${action} ignored: debounce window (${now - lastExec}ms < ${SHORTCUT_DEBOUNCE_MS}ms)`);
			return;
		}

		lastExecutionTime.set(action, now);

		try {
			if (action === "next") {
				await apiProvider.nextTrack();
			} else {
				await apiProvider.prevTrack();
			}
			return;
		} catch (error) {
			log.warn(`API action failed for ${action}`, error);
		}

		const webContents = getYoutubeWebContents();
		if (!webContents) {
			log.warn(`No youtube webContents available for ${action}`);
			return;
		}

		await runFallback(webContents, action);
	};

	const register = (accelerator: string, action: TrackAction) => {
		if (registeredShortcuts.has(accelerator)) {
			log.debug(`Shortcut already registered: ${accelerator}`);
			return;
		}

		try {
			const registered = globalShortcut.register(accelerator, () => {
				void trigger(action).catch((error) => {
					log.error(`Shortcut handler failed for ${accelerator}`, error);
				});
			});

			if (!registered) {
				log.warn(`Unable to register global shortcut: ${accelerator} (platform may not support)`);
			} else {
				log.info(`Registered global shortcut: ${accelerator}`);
				registeredShortcuts.add(accelerator);
			}
		} catch (error) {
			log.warn(`Error registering global shortcut: ${accelerator}`, error);
		}
	};

	register("Shift+Alt+Right", "next");
	register("Shift+Alt+Left", "previous");
}
