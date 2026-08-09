import { useEffect, useRef, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";
import { activeLineIndex } from "../lrc";
import type { LyricsStoreSnapshot } from "../store";
import type { LyricLine } from "../types";

export const USER_SCROLL_PAUSE_MS = 2500;

export interface LyricsUiState {
	snap: LyricsStoreSnapshot;
	timeMs: number;
	showTimeCodes: boolean;
	showProgressBar: boolean;
	settingsEpoch: number;
}

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
	subscribe: (onStoreChange: () => void) => () => void;
	getSnapshot: () => LyricsUiState;
	onSeek: (timeMs: number) => void;
}

export function LyricsApp({ subscribe, getSnapshot, onSeek }: LyricsAppProps) {
	const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
	const { snap, timeMs, showTimeCodes, showProgressBar } = state;
	const listRef = useRef<HTMLDivElement | null>(null);
	const userScrollUntil = useRef(0);
	const lastScrolledActive = useRef(-1);

	const onListScroll = () => {
		userScrollUntil.current = Date.now() + USER_SCROLL_PAUSE_MS;
	};

	const result = snap.result;
	const lines = snap.status === "ready" && result?.lines?.length ? result.lines : null;
	const activeIdx = lines ? activeLineIndex(lines, timeMs) : -1;

	useEffect(() => {
		if (activeIdx < 0 || activeIdx === lastScrolledActive.current) return;
		lastScrolledActive.current = activeIdx;
		if (Date.now() < userScrollUntil.current) return;
		const list = listRef.current;
		const el = list?.querySelector(`[data-index="${activeIdx}"]`) as HTMLElement | null;
		el?.scrollIntoView({
			block: "nearest",
			behavior: prefersReducedMotion() ? "auto" : "smooth",
		});
	}, [activeIdx, snap.videoId, state.settingsEpoch]);

	useEffect(() => {
		lastScrolledActive.current = -1;
		userScrollUntil.current = 0;
	}, [snap.videoId]);

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
			<div className="ytmd-lyrics-body">
				{result.inexact ? <div className="ytmd-lyrics-meta">Approximate match</div> : null}
				<div
					ref={listRef}
					className="ytmd-lyrics-list"
					role="list"
					onScroll={onListScroll}
				>
					{lines.map((line, i) => {
						const isActive = i === activeIdx;
						const parts = line.parts?.filter((p) => p.length > 0);
						const progress =
							isActive && showProgressBar ? lineProgressRatio(line, timeMs) : null;
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
								key={`${line.timeMs}-${i}`}
								className={lineClassName(isActive, showProgressBar && isActive)}
								data-index={i}
								role="button"
								tabIndex={0}
								aria-current={isActive ? "true" : undefined}
								style={style}
								onClick={seek}
								onKeyDown={onKeyDown}
							>
								<span className="ytmd-lyrics-line-content">
									{showTimeCodes && line.text ? (
										<span className="ytmd-lyrics-time">{formatTime(line.timeMs)}</span>
									) : null}
									{parts && parts.length > 1 ? (
										<span className="ytmd-lyrics-parts">
											{parts.map((part, p) => (
												<span
													key={p}
													className={p === 0 ? "ytmd-lyrics-part" : "ytmd-lyrics-part is-secondary"}
												>
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
					})}
				</div>
			</div>
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
