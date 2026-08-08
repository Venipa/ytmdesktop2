import {
	GM_getValue,
	GM_registerMenuCommand,
	GM_setValue,
	GM_unregisterMenuCommand,
} from "vite-plugin-monkey/dist/client";
import { toYtmd } from "./ytmd";

const DEDUPE_MS = 2000;
const AUTO_OPEN_KEY = "autoOpenOnLoad";
const AUTO_OPEN_DEFAULT = true;

let lastOpened: string | null = null;
let lastOpenedAt = 0;
let autoOpenMenuId: number | string | undefined;
let openNowMenuId: number | string | undefined;

function isAutoOpenEnabled(): boolean {
	return Boolean(GM_getValue(AUTO_OPEN_KEY, AUTO_OPEN_DEFAULT));
}

function setAutoOpenEnabled(enabled: boolean): void {
	GM_setValue(AUTO_OPEN_KEY, enabled);
	refreshMenuCommands();
}

function softOpenYtmd(ytmdUrl: string, force = false): void {
	const now = Date.now();
	if (!force && lastOpened === ytmdUrl && now - lastOpenedAt < DEDUPE_MS) return;

	const parent = document.documentElement || document.body;
	if (!parent) {
		document.addEventListener("DOMContentLoaded", () => softOpenYtmd(ytmdUrl, force), { once: true });
		return;
	}

	lastOpened = ytmdUrl;
	lastOpenedAt = now;

	try {
		const iframe = document.createElement("iframe");
		iframe.style.display = "none";
		iframe.setAttribute("aria-hidden", "true");
		iframe.src = ytmdUrl;
		parent.appendChild(iframe);
		window.setTimeout(() => {
			iframe.remove();
		}, 1500);
		return;
	} catch {
		// fall through
	}

	try {
		const a = document.createElement("a");
		a.href = ytmdUrl;
		a.style.display = "none";
		parent.appendChild(a);
		a.click();
		a.remove();
	} catch {
		// ignore
	}
}

/** Auto-open current location when toggle on and URL is actionable. */
function maybeOpenCurrentLocation(): void {
	if (!isAutoOpenEnabled()) return;
	const ytmd = toYtmd(location.href);
	if (ytmd) softOpenYtmd(ytmd);
}

/** Manual open from Tampermonkey menu (ignores auto-open toggle). */
function openCurrentPageNow(): void {
	const ytmd = toYtmd(location.href);
	if (ytmd) softOpenYtmd(ytmd, true);
}

function refreshMenuCommands(): void {
	if (autoOpenMenuId !== undefined) GM_unregisterMenuCommand(autoOpenMenuId);
	if (openNowMenuId !== undefined) GM_unregisterMenuCommand(openNowMenuId);

	const enabled = isAutoOpenEnabled();
	autoOpenMenuId = GM_registerMenuCommand(
		enabled ? "YTMDesktop: Auto-open on load — ON" : "YTMDesktop: Auto-open on load — OFF",
		() => setAutoOpenEnabled(!enabled),
	);
	openNowMenuId = GM_registerMenuCommand("YTMDesktop: Open this page now", openCurrentPageNow);
}

function patchHistory(): void {
	const wrap = (method: "pushState" | "replaceState"): void => {
		const original = history[method].bind(history);
		history[method] = ((...args: Parameters<History["pushState"]>) => {
			const result = original(...args);
			queueMicrotask(maybeOpenCurrentLocation);
			return result;
		}) as History["pushState"];
	};
	wrap("pushState");
	wrap("replaceState");
}

function start(): void {
	refreshMenuCommands();
	patchHistory();
	window.addEventListener("popstate", maybeOpenCurrentLocation);
	window.addEventListener("yt-navigate-finish", maybeOpenCurrentLocation as EventListener);
	maybeOpenCurrentLocation();
}

start();
