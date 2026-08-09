import { AnimatePresence, motion } from "motion/react";
import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useState } from "react";
import type { EmbedFlags, EmbedLayout } from "../flags";
import type { NowPlayingViewModel } from "../types";

/** Tray-inspired tokens (standalone SPA — no app Tailwind theme). */
export const C = {
	fg: "#f4f4f5",
	muted: "rgba(244,244,245,0.55)",
	mutedDim: "rgba(244,244,245,0.35)",
	border: "rgba(255,255,255,0.12)",
	borderSoft: "rgba(255,255,255,0.08)",
	bg: "#0c0c0e",
	track: "rgba(255,255,255,0.14)",
	placeholder: "rgba(255,255,255,0.08)",
	error: "rgba(248,113,113,0.95)",
	fallbackAccent: "#3b82f6",
} as const;

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
export const ART_EASE = [0.16, 1, 0.3, 1] as const;
export const ART_DURATION = 0.28;
/** Shared card corner radius (default / ticker / badge). */
export const CARD_RADIUS = 12;

export interface LayoutProps {
	readonly track: NowPlayingViewModel;
	readonly flags: EmbedFlags;
	readonly accent: string;
	readonly src: string | null;
	readonly className?: string;
	readonly status?: string | null;
}

export function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
	const s = Math.floor(seconds);
	const m = Math.floor(s / 60);
	const r = s % 60;
	return `${m}:${r.toString().padStart(2, "0")}`;
}

function useReadyImage(src: string | null | undefined): string | null {
	const [ready, setReady] = useState<string | null>(null);

	useEffect(() => {
		if (!src) {
			setReady((prev) => (prev === null ? prev : null));
			return;
		}
		let cancelled = false;
		const img = new Image();
		const done = () => {
			if (!cancelled) setReady((prev) => (prev === src ? prev : src));
		};
		img.onload = done;
		img.onerror = done;
		img.src = src;
		if (img.complete) done();
		return () => {
			cancelled = true;
			img.onload = null;
			img.onerror = null;
		};
	}, [src]);

	return ready;
}

/** Commit art + accent together when image is ready (trayview pattern). */
export function useAlignedArtDisplay(
	thumbnail: string | null | undefined,
	liveAccent: string | null,
): { src: string | null; accent: string | null } {
	const loadedSrc = useReadyImage(thumbnail);
	const [display, setDisplay] = useState<{ src: string | null; accent: string | null }>({ src: null, accent: null });

	useLayoutEffect(() => {
		const commit = (src: string | null, accent: string | null) => {
			setDisplay((prev) => (prev.src === src && prev.accent === accent ? prev : { src, accent }));
		};

		if (!thumbnail) {
			commit(null, null);
			return;
		}
		if (loadedSrc !== thumbnail) return;

		if (liveAccent) {
			commit(loadedSrc, liveAccent);
			return;
		}

		const timer = window.setTimeout(() => commit(loadedSrc, liveAccent), 80);
		return () => clearTimeout(timer);
	}, [thumbnail, loadedSrc, liveAccent]);

	return display;
}

export function BleedArt({ src, accent }: { src: string | null; accent: string }) {
	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} aria-hidden>
			<AnimatePresence mode="wait">
				{src ? (
					<motion.div
						key={src}
						style={{ position: "absolute", inset: 0 }}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: ART_DURATION, ease: ART_EASE }}
					>
						<div
							style={{
								position: "absolute",
								inset: 0,
								transform: "scale(1.1)",
								backgroundImage: `url(${src})`,
								backgroundSize: "cover",
								backgroundPosition: "center",
							}}
						/>
						<div
							style={{
								position: "absolute",
								inset: 0,
								transform: "scale(1.25)",
								backgroundImage: `url(${src})`,
								backgroundSize: "cover",
								backgroundPosition: "center",
								opacity: 0.7,
								filter: "blur(24px)",
							}}
						/>
					</motion.div>
				) : (
					<motion.div
						key="empty-bleed"
						style={{ position: "absolute", inset: 0, background: C.placeholder }}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: ART_DURATION, ease: ART_EASE }}
					/>
				)}
			</AnimatePresence>
			<motion.div
				style={{ position: "absolute", inset: 0 }}
				initial={false}
				animate={{
					backgroundColor: accent,
					opacity: src ? 0.25 : 0.12,
				}}
				transition={{ duration: ART_DURATION, ease: ART_EASE }}
			/>
			<div style={{ position: "absolute", inset: 0, background: "rgba(12,12,14,0.72)" }} />
		</div>
	);
}

export function CoverArt({
	src,
	accent,
	size = 64,
}: {
	src: string | null;
	accent: string;
	size?: number;
}) {
	return (
		<div
			style={{
				position: "relative",
				width: size,
				height: size,
				flexShrink: 0,
				overflow: "hidden",
				borderRadius: 8,
				background: C.placeholder,
				boxShadow: `0 0 0 1px ${C.borderSoft}, 0 1px 2px rgba(0,0,0,0.25)`,
			}}
		>
			<AnimatePresence mode="wait">
				{src ? (
					<motion.img
						key={src}
						src={src}
						alt=""
						width={size}
						height={size}
						style={{
							position: "absolute",
							inset: 0,
							width: "100%",
							height: "100%",
							objectFit: "cover",
							pointerEvents: "none",
						}}
						referrerPolicy="no-referrer"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: ART_DURATION, ease: ART_EASE }}
					/>
				) : (
					<motion.div
						key="empty-cover"
						style={{
							position: "absolute",
							inset: 0,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontSize: 9,
							fontWeight: 600,
							letterSpacing: "0.06em",
							color: C.muted,
							background: `linear-gradient(135deg, ${accent}55, ${C.placeholder})`,
						}}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: ART_DURATION, ease: ART_EASE }}
					>
						YTM
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

export function ProgressRow({
	track,
	accent,
	compact,
}: {
	track: NowPlayingViewModel;
	accent: string;
	compact?: boolean;
}) {
	const pct = track.duration > 0 ? Math.min(100, Math.max(0, (track.progress / track.duration) * 100)) : 0;
	const timeStyle: CSSProperties = {
		width: compact ? 32 : 36,
		flexShrink: 0,
		fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
		fontSize: 10,
		fontVariantNumeric: "tabular-nums",
		color: C.muted,
	};
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: compact ? 8 : 12, width: "100%" }}>
			<span style={{ ...timeStyle, textAlign: "right", color: C.mutedDim }}>{formatTime(track.progress)}</span>
			<div
				style={{
					position: "relative",
					height: compact ? 4 : 6,
					minWidth: 0,
					flex: 1,
					borderRadius: 999,
					background: C.track,
					overflow: "hidden",
				}}
			>
				<div
					style={{
						position: "absolute",
						inset: "0 auto 0 0",
						width: `${pct}%`,
						borderRadius: 999,
						backgroundColor: accent,
						transition: "width 100ms ease-out",
					}}
				/>
			</div>
			<span style={timeStyle}>{formatTime(track.duration)}</span>
		</div>
	);
}

export function showArt(flags: EmbedFlags): boolean {
	return flags.art && flags.layout !== "text";
}

export function showProgress(flags: EmbedFlags): boolean {
	return flags.progress && flags.layout !== "text" && flags.layout !== "badge" && flags.layout !== "ticker";
}

export function tickerLine(track: NowPlayingViewModel, flags: EmbedFlags): string {
	const parts: string[] = [];
	if (flags.artist) parts.push(track.artist);
	if (flags.title) parts.push(track.title);
	return parts.join(" — ") || track.title;
}

export function Shell({
	flags,
	layout,
	fill,
	children,
	className,
	playing,
	idle,
}: {
	flags: EmbedFlags;
	layout: EmbedLayout;
	fill?: boolean;
	children: ReactNode;
	className?: string;
	playing?: boolean;
	idle?: boolean;
}) {
	const scale = flags.scale;
	const rootStyle: CSSProperties = {
		boxSizing: "border-box",
		fontFamily: FONT,
		color: C.fg,
		width: fill ? "100%" : "max-content",
		height: fill ? "100%" : undefined,
		minWidth: fill ? "100%" : undefined,
		minHeight: fill ? "100%" : undefined,
		maxWidth: fill ? "none" : "100%",
		transformOrigin: "top left",
		transform: scale !== 1 && !fill ? `scale(${scale})` : undefined,
		background: fill ? C.bg : flags.transparent ? "transparent" : C.bg,
		padding: 0,
		borderRadius: 0,
	};
	return (
		<div
			className={className}
			style={rootStyle}
			data-ytmd-embed="now-playing"
			data-layout={layout}
			data-playing={playing ? "1" : "0"}
			data-idle={idle ? "true" : undefined}
		>
			{children}
		</div>
	);
}

export function CardFrame({
	flags,
	accent,
	src,
	children,
	style,
}: {
	flags: EmbedFlags;
	accent: string;
	src: string | null;
	children: ReactNode;
	style?: CSSProperties;
}) {
	return (
		<div
			style={{
				position: "relative",
				display: "flex",
				overflow: "hidden",
				borderRadius: CARD_RADIUS,
				border: `1px solid ${C.border}`,
				background: flags.transparent ? "transparent" : C.bg,
				boxShadow: flags.transparent ? "none" : "0 8px 28px rgba(0,0,0,0.35)",
				...style,
			}}
		>
			<BleedArt src={src} accent={accent} />
			<div
				style={{
					position: "relative",
					zIndex: 2,
					display: "flex",
					minWidth: 0,
					flex: 1,
					flexDirection: "column",
					justifyContent: "center",
				}}
			>
				{children}
			</div>
		</div>
	);
}
