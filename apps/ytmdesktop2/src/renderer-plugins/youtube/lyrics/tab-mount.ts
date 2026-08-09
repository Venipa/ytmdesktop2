import { LYRICS_ROOT_ID, SELECTORS } from "./selectors";
import styles from "./styles.css?raw";

export interface TabMountHandle {
	getHost(): HTMLElement | null;
	/** True when YTM Lyrics tab header is selected. */
	isLyricsTabSelected(): boolean;
	destroy(): void;
}

export interface TabMountOptions {
	onHostChange?: (host: HTMLElement | null) => void;
	onTabSelectedChange?: (selected: boolean) => void;
}

export function findLyricsHeader(): HTMLElement | null {
	const headers = Array.from(document.querySelectorAll(SELECTORS.tabHeaders)) as HTMLElement[];
	const labeled = headers.find((el) => /lyrics/i.test(el.getAttribute("aria-label") ?? el.textContent ?? ""));
	if (labeled) return labeled;
	const byIndex = document.querySelector(SELECTORS.lyricsTabHeader) as HTMLElement | null;
	if (byIndex) return byIndex;
	if (headers[1]) return headers[1];
	return null;
}

/** Only the lyrics page-type renderer — never the shared queue/related panel without page-type. */
export function findLyricsBody(): HTMLElement | null {
	return (document.querySelector(SELECTORS.lyricsTabBody) as HTMLElement | null) ?? null;
}

export function isLyricsTabSelected(): boolean {
	const header = findLyricsHeader();
	if (!header) return !!findLyricsBody();
	return header.getAttribute("aria-selected") === "true";
}

function ensureHost(body: HTMLElement): HTMLElement {
	let host = body.querySelector(`#${LYRICS_ROOT_ID}`) as HTMLElement | null;
	if (!host) {
		host = document.createElement("div");
		host.id = LYRICS_ROOT_ID;
		body.appendChild(host);
	}
	return host;
}

/**
 * Force-enable lyrics tab, inject CSS, keep host mounted while lyrics page-type body exists.
 * Mount ONLY when `#tab-renderer[page-type=TRACK_LYRICS]` — shared tab-renderer must not be hijacked.
 */
export async function createTabMount(domUtils: Window["domUtils"], options: TabMountOptions = {}): Promise<TabMountHandle> {
	const removeStyle = await domUtils.createStyle(styles);
	let headerObserver: MutationObserver | null = null;
	let bodyObserver: MutationObserver | null = null;
	let host: HTMLElement | null = null;
	let disposed = false;
	let lastSelected = false;
	let observedHeader: HTMLElement | null = null;

	const forceEnableHeader = (header: HTMLElement) => {
		if (header.hasAttribute("disabled")) header.removeAttribute("disabled");
		if (header.getAttribute("aria-disabled") === "true") header.setAttribute("aria-disabled", "false");
	};

	const emitTabSelected = () => {
		const selected = isLyricsTabSelected();
		if (selected === lastSelected) return;
		lastSelected = selected;
		options.onTabSelectedChange?.(selected);
	};

	const setHost = (next: HTMLElement | null) => {
		if (host === next) return;
		host = next;
		options.onHostChange?.(host);
	};

	const syncHost = () => {
		if (disposed) return;
		const header = findLyricsHeader();
		if (header) forceEnableHeader(header);
		const body = findLyricsBody();
		if (!body) {
			setHost(null);
			emitTabSelected();
			return;
		}
		setHost(ensureHost(body));
		emitTabSelected();
	};

	const armHeaderObserver = () => {
		const header = findLyricsHeader();
		if (!header) return;
		if (observedHeader === header && headerObserver) {
			forceEnableHeader(header);
			return;
		}
		headerObserver?.disconnect();
		observedHeader = header;
		forceEnableHeader(header);
		headerObserver = new MutationObserver(() => {
			forceEnableHeader(header);
			syncHost();
		});
		headerObserver.observe(header, {
			attributes: true,
			attributeFilter: ["disabled", "aria-disabled", "aria-selected"],
		});
	};

	const armBodyObserver = () => {
		bodyObserver?.disconnect();
		const root = document.querySelector("ytmusic-player-page") ?? document.querySelector("ytmusic-app") ?? document.body;
		bodyObserver = new MutationObserver(() => {
			armHeaderObserver();
			syncHost();
		});
		bodyObserver.observe(root, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["page-type", "disabled", "aria-selected"],
		});
	};

	await domUtils.awaitElement(SELECTORS.tabHeaders).catch(() => null);
	syncHost();
	armHeaderObserver();
	armBodyObserver();
	lastSelected = isLyricsTabSelected();

	return {
		getHost: () => host ?? (document.querySelector(`#${LYRICS_ROOT_ID}`) as HTMLElement | null),
		isLyricsTabSelected,
		destroy: () => {
			disposed = true;
			headerObserver?.disconnect();
			bodyObserver?.disconnect();
			headerObserver = null;
			bodyObserver = null;
			observedHeader = null;
			const node = document.querySelector(`#${LYRICS_ROOT_ID}`);
			node?.remove();
			// Cleanup leftover class from older hijack builds (broke shared tab-renderer).
			for (const el of Array.from(document.querySelectorAll(".ytmd-lyrics-hijacked"))) {
				el.classList.remove("ytmd-lyrics-hijacked");
			}
			setHost(null);
			removeStyle();
		},
	};
}
