import { activeLineIndex } from "../lrc";
import type { LyricsStoreSnapshot } from "../store";
import type { LyricLine } from "../types";

export interface LyricsRenderApi {
	setSnapshot(snap: LyricsStoreSnapshot): void;
	setTime(timeMs: number, durationMs?: number): void;
	/** Force full re-paint (host recreate / settings like showTimeCodes). */
	repaint(): void;
	destroy(): void;
}

const USER_SCROLL_PAUSE_MS = 2500;

function formatTime(ms: number): string {
	const totalSec = Math.max(0, Math.floor(ms / 1000));
	const m = Math.floor(totalSec / 60);
	const s = totalSec % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

function statusMessage(snap: LyricsStoreSnapshot): string {
	switch (snap.status) {
		case "loading":
			return "Loading lyrics…";
		case "empty":
			return "No lyrics found";
		case "error":
			return snap.errorMessage ? `Lyrics error: ${snap.errorMessage}` : "Failed to load lyrics";
		case "skipped":
			return snap.errorMessage ?? "Lyrics unavailable for this track";
		case "idle":
			return "Play a song to see lyrics";
		case "ready":
			return "No lyrics found";
		default:
			return "";
	}
}

function prefersReducedMotion(): boolean {
	try {
		return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
	} catch {
		return false;
	}
}

function lineProgressRatio(line: LyricLine, nowMs: number): number {
	const dur = line.durationMs;
	if (!(dur > 0) || !Number.isFinite(dur)) return 0;
	return Math.min(1, Math.max(0, (nowMs - line.timeMs) / dur));
}

function showStatus(body: HTMLElement, text: string) {
	body.replaceChildren();
	const status = document.createElement("div");
	status.className = "ytmd-lyrics-status";
	status.setAttribute("role", "status");
	status.textContent = text;
	body.appendChild(status);
}

/** Simple DOM UI into `#ytmd-lyrics-root`. */
export function createLyricsRenderer(
	getHost: () => HTMLElement | null,
	options: {
		showTimeCodes: () => boolean;
		showProgressBar: () => boolean;
		onSeek: (timeMs: number) => void;
	},
): LyricsRenderApi {
	let snap: LyricsStoreSnapshot = { status: "idle", result: null, videoId: null };
	let timeMs = 0;
	let lastActive = -1;
	let listEl: HTMLElement | null = null;
	let lineButtons: HTMLElement[] = [];
	let builtWithTimeCodes: boolean | null = null;
	let builtWithLineProgress: boolean | null = null;
	let userScrollUntil = 0;
	let scrollListening: HTMLElement | null = null;
	let bodyEl: HTMLElement | null = null;

	const onListScroll = () => {
		userScrollUntil = Date.now() + USER_SCROLL_PAUSE_MS;
	};

	const detachScroll = () => {
		if (scrollListening) {
			scrollListening.removeEventListener("scroll", onListScroll);
			scrollListening = null;
		}
	};

	const attachScroll = (el: HTMLElement) => {
		if (scrollListening === el) return;
		detachScroll();
		scrollListening = el;
		el.addEventListener("scroll", onListScroll, { passive: true });
	};

	const clearListState = () => {
		detachScroll();
		listEl = null;
		lineButtons = [];
		lastActive = -1;
		builtWithTimeCodes = null;
		builtWithLineProgress = null;
	};

	const ensureShell = (host: HTMLElement): HTMLElement => {
		let body = host.querySelector(".ytmd-lyrics-body") as HTMLElement | null;
		if (!body) {
			host.replaceChildren();
			host.classList.remove("has-progress");
			body = document.createElement("div");
			body.className = "ytmd-lyrics-body";
			host.appendChild(body);
			clearListState();
		}
		bodyEl = body;
		return body;
	};

	const updateLineProgress = (lines: LyricLine[]) => {
		const want = options.showProgressBar();
		const idx = lastActive;
		if (idx < 0 || !lineButtons[idx]) return;
		const btn = lineButtons[idx];
		if (!want) {
			btn.classList.remove("has-line-progress");
			btn.style.removeProperty("--ytmd-line-progress");
			return;
		}
		const line = lines[idx];
		if (!line) return;
		btn.classList.add("has-line-progress");
		btn.style.setProperty("--ytmd-line-progress", String(lineProgressRatio(line, timeMs)));
	};

	const paint = () => {
		const host = getHost();
		if (!host) return;
		const body = ensureShell(host);

		const result = snap.result;
		if (snap.status !== "ready" || !result) {
			showStatus(body, statusMessage(snap));
			clearListState();
			return;
		}

		if (result.lines?.length) {
			renderSynced(body, result.lines, false);
			return;
		}

		if (result.plain) {
			body.replaceChildren();
			clearListState();
			if (result.inexact) {
				const meta = document.createElement("div");
				meta.className = "ytmd-lyrics-meta";
				meta.textContent = "Approximate match";
				body.appendChild(meta);
			}
			const plain = document.createElement("div");
			plain.className = "ytmd-lyrics-plain";
			plain.textContent = result.plain;
			body.appendChild(plain);
			return;
		}

		showStatus(body, "No lyrics found");
		clearListState();
	};

	const updateActive = (lines: LyricLine[]) => {
		const idx = activeLineIndex(lines, timeMs);
		if (!listEl) return;

		if (idx !== lastActive) {
			if (lastActive >= 0 && lineButtons[lastActive]) {
				const prev = lineButtons[lastActive];
				prev.classList.remove("is-active", "has-line-progress");
				prev.removeAttribute("aria-current");
				prev.style.removeProperty("--ytmd-line-progress");
			}

			const next = lineButtons[idx];
			if (next) {
				next.classList.add("is-active");
				next.setAttribute("aria-current", "true");
				const userScrolling = Date.now() < userScrollUntil;
				if (!userScrolling) {
					next.scrollIntoView({
						block: "nearest",
						behavior: prefersReducedMotion() ? "auto" : "smooth",
					});
				}
			}
			lastActive = idx;
		}

		updateLineProgress(lines);
	};

	const buildList = (body: HTMLElement, lines: LyricLine[]) => {
		body.replaceChildren();
		clearListState();

		if (snap.result?.inexact) {
			const meta = document.createElement("div");
			meta.className = "ytmd-lyrics-meta";
			meta.textContent = "Approximate match";
			body.appendChild(meta);
		}

		const showTimes = options.showTimeCodes();
		const showProgress = options.showProgressBar();
		builtWithTimeCodes = showTimes;
		builtWithLineProgress = showProgress;

		listEl = document.createElement("div");
		listEl.className = "ytmd-lyrics-list";
		listEl.setAttribute("role", "list");

		lineButtons = new Array(lines.length);
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			// div, not <button> — YTM button CSS collapses/smashes text
			const btn = document.createElement("div");
			btn.className = "ytmd-lyrics-line";
			btn.dataset.index = String(i);
			btn.setAttribute("role", "button");
			btn.setAttribute("tabindex", "0");

			const content = document.createElement("span");
			content.className = "ytmd-lyrics-line-content";
			if (showTimes && line.text) {
				const time = document.createElement("span");
				time.className = "ytmd-lyrics-time";
				time.textContent = formatTime(line.timeMs);
				content.appendChild(time);
			}
			const parts = line.parts?.filter((p) => p.length > 0);
			if (parts && parts.length > 1) {
				const stack = document.createElement("span");
				stack.className = "ytmd-lyrics-parts";
				for (let p = 0; p < parts.length; p++) {
					const part = document.createElement("span");
					part.className = p === 0 ? "ytmd-lyrics-part" : "ytmd-lyrics-part is-secondary";
					part.textContent = parts[p];
					stack.appendChild(part);
				}
				content.appendChild(stack);
			} else {
				content.appendChild(document.createTextNode(line.text || "♪"));
			}
			btn.appendChild(content);

			const seek = () => options.onSeek(line.timeMs);
			btn.addEventListener("click", seek);
			btn.addEventListener("keydown", (ev) => {
				if (ev.key === "Enter" || ev.key === " ") {
					ev.preventDefault();
					seek();
				}
			});
			listEl.appendChild(btn);
			lineButtons[i] = btn;
		}

		body.appendChild(listEl);
		attachScroll(listEl);
		lastActive = -1;
		userScrollUntil = 0;
	};

	const renderSynced = (body: HTMLElement, lines: LyricLine[], forceRebuild: boolean) => {
		const showTimes = options.showTimeCodes();
		const showProgress = options.showProgressBar();
		const needsRebuild =
			forceRebuild ||
			!listEl ||
			listEl.parentElement !== body ||
			builtWithTimeCodes !== showTimes ||
			builtWithLineProgress !== showProgress;
		if (needsRebuild) buildList(body, lines);
		updateActive(lines);
	};

	return {
		setSnapshot(next) {
			const sameReady =
				snap.status === "ready" &&
				next.status === "ready" &&
				snap.videoId === next.videoId &&
				snap.result === next.result;
			snap = next;
			if (!sameReady) {
				paint();
				return;
			}
			if (next.result?.lines?.length) {
				const host = getHost();
				if (host) renderSynced(ensureShell(host), next.result.lines, false);
			} else {
				paint();
			}
		},
		setTime(ms) {
			timeMs = ms;
			// Sync path — caller already on rAF; update progress immediately.
			if (snap.status === "ready" && snap.result?.lines?.length && listEl) {
				updateActive(snap.result.lines);
			}
		},
		repaint() {
			clearListState();
			paint();
			if (snap.status === "ready" && snap.result?.lines?.length) {
				const host = getHost();
				if (host && bodyEl) updateActive(snap.result.lines);
			}
		},
		destroy() {
			detachScroll();
			const host = getHost();
			host?.replaceChildren();
			host?.classList.remove("has-progress");
			clearListState();
			bodyEl = null;
		},
	};
}
