import {
	type CSSProperties,
	type KeyboardEvent,
	memo,
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { activeLineIndices, activeWordIndex, primaryActiveLineIndex } from "../lrc";
import { wordProgress } from "../progress";
import { lyricsProviderLabel } from "../providers/catalog";
import type { LyricsStoreSnapshot } from "../store";
import type { LyricLine, LyricResult, LyricWord } from "../types";
import { LyricsSpinner } from "./LyricsSpinner";

export const USER_SCROLL_PAUSE_MS = 2500;

/** Slow-changing UI (snapshot + settings). */
export interface LyricsShellState {
	snap: LyricsStoreSnapshot;
	showTimeCodes: boolean;
	showProgressBar: boolean;
	dynamicLyrics: boolean;
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
	dynamicLyrics: () => boolean;
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
		case "stock":
			return "";
		case "ready":
			return "No lyrics found";
		default:
			return "";
	}
}

/**
 * Actionable follow-up for an empty result. Better Lyrics is cache-first: a 401 means the song is
 * simply not cached yet, which the user can fix themselves (see https://lyrics-api-docs.boidu.dev/docs/authentication).
 */
export function statusHint(snap: LyricsStoreSnapshot): string | null {
	if (snap.status !== "empty") return null;
	switch (snap.betterLyricsMiss) {
		case "uncached":
			return "Better Lyrics hasn't cached this song yet. Play it once with the Better Lyrics browser extension, or add the lyrics on Unison, then replay.";
		case "invalid-key":
			return "Better Lyrics rejected the API key set in Settings → Player → Lyrics.";
		case "rate-limited":
			return "Better Lyrics is rate-limiting requests right now. Try again in a moment.";
		default:
			return null;
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

function lineClassName(isActive: boolean, showProgress: boolean, dynamicLyrics: boolean): string {
	const parts = ["ytmd-lyrics-line"];
	if (isActive) parts.push("is-active");
	if (isActive && showProgress) parts.push("has-line-progress");
	if (dynamicLyrics) parts.push("is-dynamic");
	return parts.join(" ");
}

interface LyricsAppProps {
	subscribeShell: (onStoreChange: () => void) => () => void;
	getShell: () => LyricsShellState;
	subscribeClock: (onStoreChange: () => void) => () => void;
	getClock: () => LyricsClockState;
	onSeek: (timeMs: number) => void;
}

function wordClassName(isActiveLine: boolean, wordIdx: number, activeWord: number): string {
	const parts = ["ytmd-lyrics-word"];
	if (!isActiveLine) return parts.join(" ");
	if (wordIdx < activeWord) parts.push("is-sung");
	else if (wordIdx === activeWord) parts.push("is-current");
	return parts.join(" ");
}

interface WordSyncTextProps {
	words: LyricWord[];
	isActive: boolean;
	timeMs: number;
	dynamicLyrics: boolean;
	onSeek: (timeMs: number) => void;
}

const WordSyncText = memo(function WordSyncText({ words, isActive, timeMs, dynamicLyrics, onSeek }: WordSyncTextProps) {
	const activeWord = isActive ? activeWordIndex(words, timeMs) : -1;
	return (
		<span className="ytmd-lyrics-words">
			{words.map((word, w) => (
				<span
					key={`${word.timeMs}-${w}`}
					className={wordClassName(isActive, w, activeWord)}
					style={
						dynamicLyrics
							? ({ "--ytmd-word-progress": `${(isActive ? wordProgress(word, timeMs) : 0) * 100}%` } as CSSProperties)
							: undefined
					}
					onClick={(ev) => {
						ev.stopPropagation();
						onSeek(word.timeMs);
					}}
				>
					{word.text}
				</span>
			))}
		</span>
	);
});

interface LyricLineRowProps {
	line: LyricLine;
	index: number;
	isActive: boolean;
	progress: number | null;
	showTimeCodes: boolean;
	words: LyricWord[] | undefined;
	timeMs: number;
	dynamicLyrics: boolean;
	onSeek: (timeMs: number) => void;
}

const LyricLineRow = memo(function LyricLineRow({
	line,
	index,
	isActive,
	progress,
	showTimeCodes,
	words,
	timeMs,
	dynamicLyrics,
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

	let textBody: ReactNode;
	if (words?.length) {
		textBody = <WordSyncText words={words} isActive={isActive} timeMs={timeMs} dynamicLyrics={dynamicLyrics} onSeek={onSeek} />;
	} else if (parts && parts.length > 1) {
		textBody = (
			<span className="ytmd-lyrics-parts">
				{parts.map((part, p) => (
					<span key={p} className={p === 0 ? "ytmd-lyrics-part" : "ytmd-lyrics-part is-secondary"}>
						{part}
					</span>
				))}
			</span>
		);
	} else {
		textBody = line.text || "♪";
	}

	return (
		<div
			className={lineClassName(isActive, progress != null, dynamicLyrics)}
			data-index={index}
			role="listitem"
			tabIndex={0}
			aria-current={isActive ? "true" : undefined}
			style={style}
			onClick={seek}
			onKeyDown={onKeyDown}
		>
			<span className={showTimeCodes ? "ytmd-lyrics-line-content has-timecode" : "ytmd-lyrics-line-content"}>
				{showTimeCodes ? <span className="ytmd-lyrics-time">{formatTime(line.timeMs)}</span> : null}
				<span className="ytmd-lyrics-text">{textBody}</span>
			</span>
		</div>
	);
});

function providerMetaLabel(result: LyricResult): string {
	const name = lyricsProviderLabel(result.provider);
	const level =
		result.syncLevel === "syllable"
			? "syllable"
			: result.syncLevel === "word"
				? "word"
				: result.syncLevel === "plain"
					? "plain"
					: result.hasWordSync
						? "syllable"
						: "line";
	return `${name} · ${level}`;
}

interface SyncedListProps {
	lines: LyricLine[];
	result: LyricResult;
	showTimeCodes: boolean;
	showProgressBar: boolean;
	dynamicLyrics: boolean;
	settingsEpoch: number;
	videoId: string | null;
	subscribeClock: (onStoreChange: () => void) => () => void;
	getClock: () => LyricsClockState;
	onSeek: (timeMs: number) => void;
}

function SyncedList({
	lines,
	result,
	showTimeCodes,
	showProgressBar,
	dynamicLyrics,
	settingsEpoch,
	videoId,
	subscribeClock,
	getClock,
	onSeek,
}: SyncedListProps) {
	const timeMs = useSyncExternalStore(subscribeClock, () => getClock().timeMs, () => getClock().timeMs);
	const activeIndices = activeLineIndices(lines, timeMs);
	const activeSet = new Set(activeIndices);
	const primaryIdx = primaryActiveLineIndex(lines, timeMs);

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
		if (primaryIdx < 0) return undefined;
		if (primaryIdx === lastScrolledActive.current) return undefined;
		if (Date.now() < userScrollUntil.current) {
			// Keep lastScrolled stale so catch-up / next tick can center the real active line.
			return undefined;
		}
		const list = listRef.current;
		const el = list?.querySelector(`[data-index="${primaryIdx}"]`) as HTMLElement | null;
		if (!list || !el) return undefined;
		lastScrolledActive.current = primaryIdx;
		const smooth = !prefersReducedMotion();
		ignoreScrollUntil.current = Date.now() + (smooth ? 450 : 50);
		const raf = requestAnimationFrame(() => scrollLineToCenter(list, el, smooth));
		return () => cancelAnimationFrame(raf);
	}, [primaryIdx, videoId, settingsEpoch, catchUpNonce]);

	useLayoutEffect(() => {
		const list = listRef.current;
		if (!list) return undefined;
		const applyPad = () => {
			const pad = Math.max(24, Math.round(list.clientHeight / 2));
			list.style.paddingTop = `${pad}px`;
			list.style.paddingBottom = `${pad}px`;
			lastScrolledActive.current = -1;
			setCatchUpNonce((n) => n + 1);
		};
		applyPad();
		const ro = new ResizeObserver(applyPad);
		ro.observe(list);
		return () => ro.disconnect();
	}, [lines, videoId, settingsEpoch]);

	return (
		<div className="ytmd-lyrics-body">
			<div className="ytmd-lyrics-meta-row">
				<div className="ytmd-lyrics-meta">{providerMetaLabel(result)}</div>
				{result.inexact ? <div className="ytmd-lyrics-meta">Approximate match</div> : null}
			</div>
			<div ref={listRef} className="ytmd-lyrics-list" role="list" onScroll={onListScroll}>
				{lines.map((line, i) => {
					const isActive = activeSet.has(i);
					const words = line.words?.length ? line.words : undefined;
					const useWords = !!words?.length;
					// Line-only cues carry no per-word pacing, so a constant-rate fill drifts from the vocal;
					// in dynamic mode the active line just lights up and scales instead.
					const progress =
						isActive && showProgressBar && !useWords && !dynamicLyrics ? lineProgressRatio(line, timeMs) : null;
					return (
						<LyricLineRow
							key={`${line.timeMs}-${i}`}
							line={line}
							index={i}
							isActive={isActive}
							progress={progress}
							showTimeCodes={showTimeCodes}
							words={words}
							timeMs={isActive && useWords ? timeMs : 0}
							dynamicLyrics={dynamicLyrics}
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
	const { snap, showTimeCodes, showProgressBar, dynamicLyrics, settingsEpoch } = shell;

	const result = snap.result;
	const lines = snap.status === "ready" && result?.lines?.length ? result.lines : null;

	if (snap.status === "stock") {
		return null;
	}

	if (snap.status === "loading") {
		return (
			<div className="ytmd-lyrics-body">
				<LyricsSpinner />
			</div>
		);
	}

	if (snap.status !== "ready" || !result) {
		const hint = statusHint(snap);
		return (
			<div className="ytmd-lyrics-body">
				<div className="ytmd-lyrics-status" role="status">
					{statusMessage(snap)}
					{hint ? <div className="ytmd-lyrics-status-hint">{hint}</div> : null}
				</div>
			</div>
		);
	}

	if (lines) {
		return (
			<SyncedList
				lines={lines}
				result={result}
				showTimeCodes={showTimeCodes}
				showProgressBar={showProgressBar}
				dynamicLyrics={dynamicLyrics}
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
				<div className="ytmd-lyrics-meta-row">
					<div className="ytmd-lyrics-meta">{providerMetaLabel(result)}</div>
					{result.inexact ? <div className="ytmd-lyrics-meta">Approximate match</div> : null}
				</div>
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
