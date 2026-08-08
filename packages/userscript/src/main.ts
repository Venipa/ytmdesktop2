import {
	GM_getValue,
	GM_registerMenuCommand,
	GM_setValue,
	GM_unregisterMenuCommand,
} from "vite-plugin-monkey/dist/client";
import { type HostSite, hostSiteFromUrl, toYtmd } from "./ytmd";

const DEDUPE_MS = 2000;

interface SiteSetting {
	key: string;
	label: string;
	defaultEnabled: boolean;
}

const SITE_SETTINGS: Record<HostSite, SiteSetting> = {
	music: {
		key: "site.music.youtube.com",
		label: "music.youtube.com",
		defaultEnabled: true,
	},
	youtube: {
		key: "site.youtube.com",
		label: "youtube.com",
		defaultEnabled: false,
	},
	mYoutube: {
		key: "site.m.youtube.com",
		label: "m.youtube.com",
		defaultEnabled: false,
	},
	youtuBe: {
		key: "site.youtu.be",
		label: "youtu.be",
		defaultEnabled: false,
	},
};

const SITE_ORDER: HostSite[] = ["music", "youtube", "mYoutube", "youtuBe"];

let lastOpened: string | null = null;
let lastOpenedAt = 0;
const menuIds: Array<number | string> = [];

function isSiteEnabled(site: HostSite): boolean {
	const setting = SITE_SETTINGS[site];
	return Boolean(GM_getValue(setting.key, setting.defaultEnabled));
}

function setSiteEnabled(site: HostSite, enabled: boolean): void {
	GM_setValue(SITE_SETTINGS[site].key, enabled);
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

/** Auto-open current location when that host’s setting is on and URL is actionable. */
function maybeOpenCurrentLocation(): void {
	const site = hostSiteFromUrl(location.href);
	if (!site || !isSiteEnabled(site)) return;
	const ytmd = toYtmd(location.href);
	if (ytmd) softOpenYtmd(ytmd);
}

/** Manual open from Tampermonkey menu (ignores per-host auto-open settings). */
function openCurrentPageNow(): void {
	const ytmd = toYtmd(location.href);
	if (ytmd) softOpenYtmd(ytmd, true);
}

function clearMenuCommands(): void {
	for (const id of menuIds) GM_unregisterMenuCommand(id);
	menuIds.length = 0;
}

function refreshMenuCommands(): void {
	clearMenuCommands();

	for (const site of SITE_ORDER) {
		const setting = SITE_SETTINGS[site];
		const enabled = isSiteEnabled(site);
		const id = GM_registerMenuCommand(
			`YTMDesktop: ${setting.label} — ${enabled ? "ON" : "OFF"}`,
			() => setSiteEnabled(site, !enabled),
		);
		menuIds.push(id);
	}

	menuIds.push(GM_registerMenuCommand("YTMDesktop: Open this page now", openCurrentPageNow));
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
