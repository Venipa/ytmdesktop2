import {
	memo,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
	type CSSProperties,
	type KeyboardEvent,
} from "react";
import { activeLineIndex } from "../lrc";
import type { LyricsStoreSnapshot } from "../store";
import type { LyricLine } from "../types";

export const USER_SCROLL_PAUSE_MS = 2500;

/** Slow-changing UI (snapshot + settings). */
export interface LyricsShellState {
	snap: LyricsStoreSnapshot;
	showTimeCodes: boolean;
	showProgressBar: boolean;
	settingsEpoch: number;
}

/** High-freq playback clock — separate store so inactive lines skip reconcile. */
export interface LyricsClockState {
	timeMs: number;
}

export interface LyricsUiState extends LyricsShellState, LyricsClockState {}

export interface LyricsUiOptions {
	showTimeCodes: () => boolean;
	showProgressBar: () => boolean;
	onSeek: (timeMs: number) => void;
}

function formatTime(ms: number): string {
	const totalSec = Math.max(0, Math.floor(ms / 1000));
	const m = Math.floor(totalSec / 60);
	const s = totalSec % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

export function statusMessage(snap: LyricsStoreSnapshot): string {
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

/** Scroll active line to vertical middle of the list (not nearest / not page ancestors). */
export function scrollLineToCenter(list: HTMLElement, el: HTMLElement, smooth: boolean): void {
	const listRect = list.getBoundingClientRect();
	const elRect = el.getBoundingClientRect();
	const delta = elRect.top - listRect.top - listRect.height / 2 + elRect.height / 2;
	const top = Math.max(0, list.scrollTop + delta);
	list.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
}

function lineProgressRatio(line: LyricLine, nowMs: number): number {
	const dur = line.durationMs;
	if (!(dur > 0) || !Number.isFinite(dur)) return 0;
	return Math.min(1, Math.max(0, (nowMs - line.timeMs) / dur));
}

function lineClassName(isActive: boolean, showProgress: boolean): string {
	const parts = ["ytmd-lyrics-line"];
	if (isActive) parts.push("is-active");
	if (isActive && showProgress) parts.push("has-line-progress");
	return parts.join(" ");
}

interface LyricsAppProps {
	subscribeShell: (onStoreChange: () => void) => () => void;
	getShell: () => LyricsShellState;
	subscribeClock: (onStoreChange: () => void) => () => void;
	getClock: () => LyricsClockState;
	onSeek: (timeMs: number) => void;
}

interface LyricLineRowProps {
	line: LyricLine;
	index: number;
	isActive: boolean;
	progress: number | null;
	showTimeCodes: boolean;
	onSeek: (timeMs: number) => void;
}

const LyricLineRow = memo(function LyricLineRow({
	line,
	index,
	isActive,
	progress,
	showTimeCodes,
	onSeek,
}: LyricLineRowProps) {
	const parts = line.parts?.filter((p) => p.length > 0);
	const style =
		progress != null
			? ({ ["--ytmd-line-progress" as string]: String(progress) } as CSSProperties)
			: undefined;

	const seek = () => onSeek(line.timeMs);
	const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>) => {
		if (ev.key === "Enter" || ev.key === " ") {
			ev.preventDefault();
			seek();
		}
	};

	return (
		<div
			className={lineClassName(isActive, progress != null)}
			data-index={index}
			role="listitem"
			tabIndex={0}
			aria-current={isActive ? "true" : undefined}
			style={style}
			onClick={seek}
			onKeyDown={onKeyDown}
		>
			<span className="ytmd-lyrics-line-content">
				{showTimeCodes && line.text ? <span className="ytmd-lyrics-time">{formatTime(line.timeMs)}</span> : null}
				{parts && parts.length > 1 ? (
					<span className="ytmd-lyrics-parts">
						{parts.map((part, p) => (
							<span key={p} className={p === 0 ? "ytmd-lyrics-part" : "ytmd-lyrics-part is-secondary"}>
								{part}
							</span>
						))}
					</span>
				) : (
					line.text || "♪"
				)}
			</span>
		</div>
	);
});

interface SyncedListProps {
	lines: LyricLine[];
	inexact?: boolean;
	showTimeCodes: boolean;
	showProgressBar: boolean;
	settingsEpoch: number;
	videoId: string | null;
	subscribeClock: (onStoreChange: () => void) => () => void;
	getClock: () => LyricsClockState;
	onSeek: (timeMs: number) => void;
}

function SyncedList({
	lines,
	inexact,
	showTimeCodes,
	showProgressBar,
	settingsEpoch,
	videoId,
	subscribeClock,
	getClock,
	onSeek,
}: SyncedListProps) {
	const timeMs = useSyncExternalStore(subscribeClock, () => getClock().timeMs, () => getClock().timeMs);
	const activeIdx = activeLineIndex(lines, timeMs);

	const listRef = useRef<HTMLDivElement | null>(null);
	const userScrollUntil = useRef(0);
	const lastScrolledActive = useRef(-1);
	const ignoreScrollUntil = useRef(0);
	const catchUpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [catchUpNonce, setCatchUpNonce] = useState(0);

	const clearCatchUpTimer = () => {
		if (catchUpTimer.current != null) {
			clearTimeout(catchUpTimer.current);
			catchUpTimer.current = null;
		}
	};

	const onListScroll = () => {
		if (Date.now() < ignoreScrollUntil.current) return;
		userScrollUntil.current = Date.now() + USER_SCROLL_PAUSE_MS;
		clearCatchUpTimer();
		const delay = USER_SCROLL_PAUSE_MS + 16;
		catchUpTimer.current = setTimeout(() => {
			catchUpTimer.current = null;
			// Force re-center on current active after pause (do not leave lastScrolled stuck).
			lastScrolledActive.current = -1;
			setCatchUpNonce((n) => n + 1);
		}, delay);
	};

	useEffect(() => {
		lastScrolledActive.current = -1;
		userScrollUntil.current = 0;
		ignoreScrollUntil.current = 0;
		clearCatchUpTimer();
	}, [videoId]);

	useEffect(() => () => clearCatchUpTimer(), []);

	useEffect(() => {
		if (activeIdx < 0) return undefined;
		if (activeIdx === lastScrolledActive.current) return undefined;
		if (Date.now() < userScrollUntil.current) {
			// Keep lastScrolled stale so catch-up / next tick can center the real active line.
			return undefined;
		}
		const list = listRef.current;
		const el = list?.querySelector(`[data-index="${activeIdx}"]`) as HTMLElement | null;
		if (!list || !el) return undefined;
		lastScrolledActive.current = activeIdx;
		const smooth = !prefersReducedMotion();
		ignoreScrollUntil.current = Date.now() + (smooth ? 450 : 50);
		const raf = requestAnimationFrame(() => scrollLineToCenter(list, el, smooth));
		return () => cancelAnimationFrame(raf);
	}, [activeIdx, videoId, settingsEpoch, catchUpNonce]);

	useLayoutEffect(() => {
		const list = listRef.current;
		if (!list) return undefined;
		const applyPad = () => {
			const pad = Math.max(24, Math.round(list.clientHeight / 2));
			list.style.paddingTop = `${pad}px`;
			list.style.paddingBottom = `${pad}px`;
		};
		applyPad();
		const ro = new ResizeObserver(applyPad);
		ro.observe(list);
		return () => ro.disconnect();
	}, [lines, videoId, settingsEpoch]);

	return (
		<div className="ytmd-lyrics-body">
			{inexact ? <div className="ytmd-lyrics-meta">Approximate match</div> : null}
			<div ref={listRef} className="ytmd-lyrics-list" role="list" onScroll={onListScroll}>
				{lines.map((line, i) => {
					const isActive = i === activeIdx;
					const progress = isActive && showProgressBar ? lineProgressRatio(line, timeMs) : null;
					return (
						<LyricLineRow
							key={`${line.timeMs}-${i}`}
							line={line}
							index={i}
							isActive={isActive}
							progress={progress}
							showTimeCodes={showTimeCodes}
							onSeek={onSeek}
						/>
					);
				})}
			</div>
		</div>
	);
}

export function LyricsApp({ subscribeShell, getShell, subscribeClock, getClock, onSeek }: LyricsAppProps) {
	const shell = useSyncExternalStore(subscribeShell, getShell, getShell);
	const { snap, showTimeCodes, showProgressBar, settingsEpoch } = shell;

	const result = snap.result;
	const lines = snap.status === "ready" && result?.lines?.length ? result.lines : null;

	if (snap.status !== "ready" || !result) {
		return (
			<div className="ytmd-lyrics-body">
				<div className="ytmd-lyrics-status" role="status">
					{statusMessage(snap)}
				</div>
			</div>
		);
	}

	if (lines) {
		return (
			<SyncedList
				lines={lines}
				inexact={result.inexact}
				showTimeCodes={showTimeCodes}
				showProgressBar={showProgressBar}
				settingsEpoch={settingsEpoch}
				videoId={snap.videoId}
				subscribeClock={subscribeClock}
				getClock={getClock}
				onSeek={onSeek}
			/>
		);
	}

	if (result.plain) {
		return (
			<div className="ytmd-lyrics-body">
				{result.inexact ? <div className="ytmd-lyrics-meta">Approximate match</div> : null}
				<div className="ytmd-lyrics-plain">{result.plain}</div>
			</div>
		);
	}

	return (
		<div className="ytmd-lyrics-body">
			<div className="ytmd-lyrics-status" role="status">
				No lyrics found
			</div>
		</div>
	);
}
