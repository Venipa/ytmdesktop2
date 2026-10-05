import { activeWordIndex, primaryActiveLineIndex } from "@plugins/youtube/lyrics/lrc";
import { wordProgress } from "@plugins/youtube/lyrics/progress";
import {
	DEFAULT_LYRICS_OVERLAY_SETTINGS,
	EMPTY_LYRICS_OVERLAY_SNAPSHOT,
	type LyricsOverlayClock,
	type LyricsOverlayLine,
	type LyricsOverlaySettings,
	type LyricsOverlaySnapshot,
	type LyricsOverlayWord,
	readLyricsOverlaySettings,
	resolveLyricsOverlayTimeMs,
} from "@shared/lyrics/overlay";
import { createFileRoute } from "@tanstack/react-router";
import { GripHorizontalIcon, LockIcon, Settings2Icon, XIcon } from "lucide-react";
import { type CSSProperties, memo, useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import "@/styles/lyrics-overlay.css";

export const Route = createFileRoute("/lyrics-overlay")({
	component: LyricsOverlayPage,
});

const OVERLAY_SETTINGS_KEY = "lyrics.overlay";

/** `lyrics.overlay.*` + `lyrics.enabled`, kept live through the settings change stream. */
function useOverlaySettings(): { overlay: LyricsOverlaySettings; lyricsEnabled: boolean } {
	const utils = trpc.useUtils();
	const overlayInput = useMemo(() => ({ key: OVERLAY_SETTINGS_KEY, defaultValue: DEFAULT_LYRICS_OVERLAY_SETTINGS }), []);
	const enabledInput = useMemo(() => ({ key: "lyrics.enabled", defaultValue: false }), []);
	const { data: rawOverlay } = trpc.settings.get.useQuery(overlayInput);
	const { data: rawEnabled } = trpc.settings.get.useQuery(enabledInput);

	trpc.settings.onChange.useSubscription(undefined, {
		onData: (ev) => {
			if (ev.key === "lyrics.enabled") {
				utils.settings.get.setData(enabledInput, ev.value);
				return;
			}
			if (ev.key === OVERLAY_SETTINGS_KEY) {
				utils.settings.get.setData(overlayInput, ev.value);
				return;
			}
			if (ev.key.startsWith(`${OVERLAY_SETTINGS_KEY}.`)) {
				const field = ev.key.slice(OVERLAY_SETTINGS_KEY.length + 1);
				utils.settings.get.setData(overlayInput, (prev) => ({ ...(prev as object), [field]: ev.value }));
			}
		},
	});

	return {
		overlay: useMemo(() => readLyricsOverlaySettings(rawOverlay), [rawOverlay]),
		lyricsEnabled: rawEnabled === true,
	};
}

function useOverlayFeed() {
	const utils = trpc.useUtils();
	const { data: snapshot } = trpc.lyrics.overlaySnapshot.useQuery();
	const { data: clock } = trpc.lyrics.overlayClock.useQuery();
	const { data: state } = trpc.lyrics.overlayState.useQuery();

	trpc.lyrics.onOverlaySnapshot.useSubscription(undefined, {
		onData: (next) => utils.lyrics.overlaySnapshot.setData(undefined, next as LyricsOverlaySnapshot),
	});
	trpc.lyrics.onOverlayClock.useSubscription(undefined, {
		onData: (next) => utils.lyrics.overlayClock.setData(undefined, next as LyricsOverlayClock),
	});
	trpc.lyrics.onOverlayState.useSubscription(undefined, {
		onData: (next) => utils.lyrics.overlayState.setData(undefined, next),
	});

	return {
		snapshot: snapshot ?? EMPTY_LYRICS_OVERLAY_SNAPSHOT,
		clock: clock ?? null,
		locked: state?.locked ?? false,
	};
}

/** Local playback time extrapolated from the last clock packet; only animates while playing. */
function usePlaybackTime(clock: LyricsOverlayClock | null): number {
	const [timeMs, setTimeMs] = useState(() => Math.round(resolveLyricsOverlayTimeMs(clock, Date.now())));
	useEffect(() => {
		let raf = 0;
		const frame = () => {
			setTimeMs(Math.round(resolveLyricsOverlayTimeMs(clock, Date.now())));
			if (clock?.playing) raf = requestAnimationFrame(frame);
		};
		frame();
		return () => cancelAnimationFrame(raf);
	}, [clock]);
	return timeMs;
}

function lineProgress(line: LyricsOverlayLine, timeMs: number): number {
	if (!(line.durationMs > 0) || !Number.isFinite(line.durationMs)) return 0;
	return Math.min(1, Math.max(0, (timeMs - line.timeMs) / line.durationMs));
}

interface WordsProps {
	words: LyricsOverlayWord[];
	activeWord: number;
	/** Playback time for the sweep; null = step only. */
	fillTimeMs: number | null;
}

const Words = memo(function Words({ words, activeWord, fillTimeMs }: WordsProps) {
	return (
		<>
			{words.map((word, w) => {
				const cls = w < activeWord ? "ytmd-overlay-word is-sung" : w === activeWord ? "ytmd-overlay-word is-current" : "ytmd-overlay-word";
				const style =
					fillTimeMs != null
						? ({ "--ytmd-word-progress": `${wordProgress(word, fillTimeMs) * 100}%` } as CSSProperties)
						: undefined;
				return (
					<span key={`${word.timeMs}-${w}`} className={cls} style={style}>
						{word.text}
					</span>
				);
			})}
		</>
	);
});

interface LineProps {
	line: LyricsOverlayLine;
	isActive: boolean;
	lineStyle: LyricsOverlaySettings["lineStyle"];
	timeMs: number;
}

const Line = memo(function Line({ line, isActive, lineStyle, timeMs }: LineProps) {
	const words = line.words?.length ? line.words : null;
	const activeWord = isActive && words ? activeWordIndex(words, timeMs) : -1;
	const sweeping = isActive && !!words && lineStyle === "fill";
	// The bar is the only line-only indicator: constant rate across the line's duration.
	const barProgress = isActive && !words && lineStyle === "bar" ? lineProgress(line, timeMs) : null;
	const style = barProgress != null ? ({ "--ytmd-line-progress": String(barProgress) } as CSSProperties) : undefined;
	const text = line.text || "♪";

	return (
		<div
			className={cn("ytmd-overlay-line", `style-${lineStyle}`, isActive ? "is-active" : "is-next", words && "has-words")}
			style={style}
		>
			<span className="ytmd-overlay-base">
				{words ? <Words words={words} activeWord={activeWord} fillTimeMs={null} /> : text}
			</span>
			{sweeping && words ? (
				<span className="ytmd-overlay-fill" aria-hidden="true">
					<Words words={words} activeWord={activeWord} fillTimeMs={timeMs} />
				</span>
			) : null}
		</div>
	);
});

function trackLabel(snap: LyricsOverlaySnapshot): string {
	const artists = snap.artists.filter(Boolean).join(", ");
	if (snap.title && artists) return `${snap.title} · ${artists}`;
	return snap.title || artists;
}

function statusLine(snap: LyricsOverlaySnapshot, lyricsEnabled: boolean, locked: boolean): string | null {
	if (!lyricsEnabled || snap.status === "disabled") return locked ? null : "Enable lyrics in Settings → Player → Lyrics";
	switch (snap.status) {
		case "loading":
			return locked ? null : "Loading lyrics…";
		case "ready":
			return null;
		case "plain":
		case "empty":
			return trackLabel(snap) || (locked ? null : "No synced lyrics for this song");
		default:
			return locked ? null : "Play a song to see lyrics here";
	}
}

function LyricsOverlayPage() {
	const { overlay, lyricsEnabled } = useOverlaySettings();
	const { snapshot, clock, locked } = useOverlayFeed();
	const timeMs = usePlaybackTime(clock);
	const { mutate: setLocked } = trpc.lyrics.setOverlayLocked.useMutation();
	const { mutate: setEnabled } = trpc.lyrics.setOverlayEnabled.useMutation();
	const { mutate: openSettings } = trpc.app.openSettings.useMutation();

	useEffect(() => {
		document.documentElement.classList.add("translucent");
		document.title = "Lyrics";
		return () => document.documentElement.classList.remove("translucent");
	}, []);

	const lines = lyricsEnabled && snapshot.status === "ready" ? snapshot.lines : null;
	const activeIdx = lines ? primaryActiveLineIndex(lines, timeMs) : -1;
	const active = lines && activeIdx >= 0 ? lines[activeIdx] : null;
	const next = lines && activeIdx + 1 < lines.length ? lines[activeIdx + 1] : null;
	// Before the first cue, preview the first line as "next" so the window is not blank.
	const upcoming = active ? next : (lines?.[0] ?? null);
	const status = statusLine(snapshot, lyricsEnabled, locked);

	const rootStyle = {
		"--ytmd-ov-text": overlay.textColor,
		"--ytmd-ov-accent": overlay.accentColor,
		"--ytmd-ov-next": overlay.nextLineColor,
		"--ytmd-ov-font-size": `${overlay.fontSize}px`,
		"--ytmd-ov-outline-color": overlay.outlineColor,
		"--ytmd-ov-outline-width": `${overlay.outlineWidth}px`,
		"--ytmd-ov-shadow-color": overlay.shadowColor,
		"--ytmd-ov-bar-bg": overlay.barBackground,
		"--ytmd-ov-bar-fg": overlay.barProgressColor,
	} as CSSProperties;

	return (
		<div className={cn(
				"ytmd-overlay",
				locked ? "is-locked" : "is-unlocked",
				!overlay.textOutline && "no-outline",
				!overlay.textShadow && "no-shadow",
			)} style={rootStyle}>
			{!locked ? (
				<div className="ytmd-overlay-bar">
					<GripHorizontalIcon className="ytmd-overlay-grip size-3.5" />
					<span className="ytmd-overlay-hint">Drag to move · pull the edges to resize · lock when done</span>
					<button type="button" onClick={() => openSettings()} title="Lyrics settings">
						<Settings2Icon className="size-3" />
					</button>
					<button type="button" className="is-primary" onClick={() => setLocked(true)} title="Lock: click-through and always on top">
						<LockIcon className="size-3" />
						Lock
					</button>
					<button type="button" onClick={() => setEnabled(false)} title="Hide desktop lyrics">
						<XIcon className="size-3" />
					</button>
				</div>
			) : null}
			<div className={cn("ytmd-overlay-lines", `align-${overlay.align}`)}>
				{active ? <Line line={active} isActive lineStyle={overlay.lineStyle} timeMs={timeMs} /> : null}
				{overlay.showNextLine && upcoming ? <Line line={upcoming} isActive={false} lineStyle={overlay.lineStyle} timeMs={timeMs} /> : null}
				{!active && !upcoming && status ? (
					<div className="ytmd-overlay-line is-status">
						<span className="ytmd-overlay-base">{status}</span>
					</div>
				) : null}
			</div>
		</div>
	);
}
