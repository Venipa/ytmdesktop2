import { toAppThumbUrl } from "@shared/media/appThumbUrl";
import { createFileRoute } from "@tanstack/react-router";
import { cva } from "class-variance-authority";
import { intervalToDuration } from "date-fns";
import { clamp } from "lodash-es";
import { ArrowLeftIcon, GripVerticalIcon, ListMusicIcon, PinIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ButtonHTMLAttributes, type MouseEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import LikeIcon from "@/assets/icons/like.svg?react";
import NextIcon from "@/assets/icons/next.svg?react";
import PauseIcon from "@/assets/icons/pause.svg?react";
import PlayIcon from "@/assets/icons/play.svg?react";
import PrevIcon from "@/assets/icons/prev.svg?react";
import SettingsIcon from "@/assets/icons/settings.svg?react";
import { TrayQueueList } from "@/components/trayview/tray-queue-list";
import { TrayVolumeControl } from "@/components/trayview/tray-volume-control";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocalState } from "@/hooks/use-local-state";
import { useTrack, useTrackState } from "@/hooks/use-track";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trayview")({
	component: TrayViewPage,
});

interface PlayState {
	playing: boolean;
	progress: number;
	duration: number;
	liked: boolean;
	disliked: boolean;
}

function patchPlayState(utils: ReturnType<typeof trpc.useUtils>, patch: Partial<PlayState>) {
	utils.track.state.setData(undefined, (prev) => {
		if (!prev) return prev;
		return { ...prev, ...patch };
	});
}

const zeroPad = (num: number | undefined): string => String(num ?? 0).padStart(2, "0");

function formatTime(seconds: number): string {
	const elapsed = Math.max(0, Math.floor(seconds));
	const { hours, minutes, seconds: secs } = intervalToDuration({ start: 0, end: elapsed * 1000 });
	const parts = [hours, minutes, secs].filter((p, i) => (i === 0 ? Boolean(p) : true)).map(zeroPad);
	return parts.join(":");
}

const ART_EASE = [0.16, 1, 0.3, 1] as const;
const ART_DURATION = 0.28;

/** Preload image; only expose src once decode-ready. */
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

/**
 * Commit art + accent together when the image for `thumbnail` is ready,
 * so cover/bleed fades and color lerps start in the same frame.
 */
function useAlignedArtDisplay(thumbnail: string | null | undefined, liveAccent: string | null): { src: string | null; accent: string | null } {
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
		// Still decoding next cover — keep previous art+accent on screen.
		if (loadedSrc !== thumbnail) return;

		// Accent already known — swap art + color together.
		if (liveAccent) {
			commit(loadedSrc, liveAccent);
			return;
		}

		// Image ready first — brief wait so vibrant/playState accent can catch up.
		const timer = window.setTimeout(() => commit(loadedSrc, liveAccent), 80);
		return () => clearTimeout(timer);
	}, [thumbnail, loadedSrc, liveAccent]);

	return display;
}

function TrayBleedArt({ src, accent }: { src: string | null; accent: string | null }) {
	return (
		<div className="pointer-events-none absolute inset-0" aria-hidden>
			<AnimatePresence mode="wait">
				{src ? (
					<motion.div
						key={src}
						className="absolute inset-0"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: ART_DURATION, ease: ART_EASE }}
					>
						<div className="absolute inset-0 scale-110 bg-cover bg-center" style={{ backgroundImage: `url(${src})` }} />
						<div className="absolute inset-0 scale-125 bg-cover bg-center opacity-70 blur-2xl" style={{ backgroundImage: `url(${src})` }} />
					</motion.div>
				) : (
					<motion.div
						key="empty-bleed"
						className="absolute inset-0 bg-muted/30"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: ART_DURATION, ease: ART_EASE }}
					/>
				)}
			</AnimatePresence>
			{/* Accent wash — same duration/ease as pill; color follows displayAccent */}
			<motion.div
				className="absolute inset-0"
				initial={false}
				animate={{
					backgroundColor: accent ?? "var(--accent)",
					opacity: accent ? 0.25 : 0,
				}}
				transition={{ duration: ART_DURATION, ease: ART_EASE }}
			/>
			<div className="absolute inset-0 bg-background/70" />
		</div>
	);
}

function TrayAccentPill({ accent, drag, expanded }: { accent: string | null; drag?: boolean; expanded?: boolean }) {
	const [dragLayer, setDragLayer] = useState(false);

	useEffect(() => {
		if (!drag || !expanded) {
			setDragLayer(false);
			return;
		}
		const id = window.setTimeout(() => setDragLayer(true), 200);
		return () => clearTimeout(id);
	}, [drag, expanded]);

	return (
		<div
			className={cn(
				"relative z-10 flex shrink-0 items-stretch justify-center py-2.5 ml-1 no-drag transition-[width] duration-200 ease-out w-3",
			)}
			aria-hidden={!drag}
			title={drag ? "Drag" : undefined}
		>
			<motion.div
				className={cn(
					"pointer-events-none flex items-center justify-center overflow-hidden rounded-full bg-accent transition-[width] duration-200 ease-out",
					expanded ? "w-3" : "w-1.5",
				)}
				initial={false}
				animate={{ backgroundColor: accent ?? "var(--accent)" }}
				transition={{ duration: ART_DURATION, ease: ART_EASE }}
			>
				<GripVerticalIcon
					className={cn("size-3.5 shrink-0 text-background/80 transition-opacity duration-200", expanded ? "opacity-100" : "opacity-0")}
				/>
			</motion.div>
			{dragLayer ? <div className="drag absolute inset-0 z-10 cursor-grab" /> : null}
		</div>
	);
}

function TrayCoverArt({ src }: { src: string | null }) {
	return (
		<div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted/80 ring-1 ring-border/50 shadow-sm">
			<AnimatePresence mode="wait">
				{src ? (
					<motion.img
						key={src}
						src={src}
						alt=""
						className="no-drag absolute inset-0 size-full object-cover pointer-events-none"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: ART_DURATION, ease: ART_EASE }}
					/>
				) : (
					<motion.div
						key="empty-cover"
						className="no-drag absolute inset-0 flex size-full items-center justify-center text-[9px] font-medium tracking-wide text-muted-foreground"
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

const chromeButtonVariants = cva(
	[
		"inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-[transform,background-color,color] duration-100",
		"enabled:hover:bg-accent/20 enabled:hover:text-foreground enabled:active:scale-95",
		"disabled:pointer-events-none disabled:opacity-40",
		"[&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
	].join(" "),
	{ variants: { variant: { default: "" } }, defaultVariants: { variant: "default" } },
);

function ChromeButton({ className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
	return <button type={type} className={cn(chromeButtonVariants(), className)} {...props} />;
}

const playerButtonVariants = cva(
	[
		"inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground transition-[transform,background-color,color] duration-100",
		"enabled:hover:bg-foreground/10 enabled:active:scale-95",
		"disabled:pointer-events-none disabled:opacity-50",
		"[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
		"data-[active=true]:text-accent",
	].join(" "),
	{
		variants: {
			variant: {
				default: "",
				hero: "size-9 bg-foreground/10 [&_svg]:size-[1.125rem]",
			},
		},
		defaultVariants: { variant: "default" },
	},
);

function PlayerButton({
	className,
	variant,
	active,
	type = "button",
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "hero"; active?: boolean }) {
	return (
		<button type={type} data-active={active ? "true" : undefined} className={cn(playerButtonVariants({ variant }), className)} {...props} />
	);
}

function pointerInsideWindow(ev: { clientX: number; clientY: number }): boolean {
	return ev.clientX >= 0 && ev.clientY >= 0 && ev.clientX < window.innerWidth && ev.clientY < window.innerHeight;
}
function TrayViewPage() {
	const utils = trpc.useUtils();
	const track = useTrack();
	const playState = useTrackState();
	const [trackBusy, setTrackBusy] = useState(false);
	const [trackAccent, setTrackAccent] = useState<string | null>(null);
	const playStateRef = useRef(playState);
	playStateRef.current = playState;

	const { data: pinned = false } = trpc.trayView.pinned.useQuery();
	const [queueOpen, setQueueOpen] = useLocalState("ytmd.tray.queueOpen", false);
	const [contentHovered, setContentHovered] = useState(false);
	const [leftThirdHovered, setHoverThreshold] = useState(false);
	const [chromeTooltipOpen, setChromeTooltipOpen] = useState(false);
	const chromeVisible = contentHovered || chromeTooltipOpen;

	const { mutateAsync: next } = trpc.track.next.useMutation();
	const { mutateAsync: prev } = trpc.track.prev.useMutation();
	const { mutateAsync: pause } = trpc.track.pause.useMutation();
	const { mutateAsync: play } = trpc.track.play.useMutation();
	const { mutateAsync: seek } = trpc.track.seek.useMutation();
	const { mutateAsync: like } = trpc.track.like.useMutation();
	const { mutateAsync: dislike } = trpc.track.dislike.useMutation();
	const { mutateAsync: hideTrayView } = trpc.trayView.hide.useMutation();
	const { mutateAsync: openMain } = trpc.trayView.openMain.useMutation();
	const { mutateAsync: toggleTrayPin } = trpc.trayView.togglePinned.useMutation();
	const { mutateAsync: setTrayQueueOpen } = trpc.trayView.setQueueOpen.useMutation();
	const { mutateAsync: openSettings } = trpc.app.openSettings.useMutation();

	useEffect(() => {
		document.title = "YouTube Music - Tray";
	}, []);

	useLayoutEffect(() => {
		const html = document.documentElement;
		const body = document.body;
		const app = document.getElementById("app");
		html.style.overflow = "hidden";
		body.style.overflow = "hidden";
		if (app) app.style.overflow = "hidden";
		html.scrollTop = 0;
		body.scrollTop = 0;
		window.scrollTo(0, 0);
		if (queueOpen) void setTrayQueueOpen({ open: true });
		return () => {
			html.style.overflow = "";
			body.style.overflow = "";
			if (app) app.style.overflow = "";
		};
	}, []);

	useEffect(() => {
		const collapse = (ev: { clientX: number; clientY: number }) => {
			if (pointerInsideWindow(ev)) return;
			setHoverThreshold(false);
		};
		const onBlur = () => setHoverThreshold(false);
		const root = document.documentElement;
		root.addEventListener("mouseleave", collapse);
		window.addEventListener("blur", onBlur);
		return () => {
			root.removeEventListener("mouseleave", collapse);
			window.removeEventListener("blur", onBlur);
		};
	}, []);

	trpc.trayView.onState.useSubscription(undefined, {
		onData: (state) => {
			if (typeof state?.pinned === "boolean") utils.trayView.pinned.setData(undefined, state.pinned);
		},
	});

	async function setQueueVisible(open: boolean) {
		try {
			if (!open) {
				await setTrayQueueOpen({ open: false });
				setQueueOpen(false);
				window.scrollTo(0, 0);
				document.documentElement.scrollTop = 0;
				document.body.scrollTop = 0;
				return;
			}
			setQueueOpen(true);
			await setTrayQueueOpen({ open: true });
			window.scrollTo(0, 0);
		} catch {
			setQueueOpen(!open);
		}
	}

	const thumbnail = toAppThumbUrl(track?.meta?.thumbnail);
	const playing = !!playState?.playing;
	const title = track?.video?.title ?? "Nothing playing";
	const artist = track?.video?.author ?? "";
	const hasLike = typeof playState?.liked === "boolean";
	const hasDislike = typeof playState?.disliked === "boolean";
	const liveAccent = trackAccent || playState?.accent || null;
	const { src: artSrc, accent: displayAccent } = useAlignedArtDisplay(thumbnail, liveAccent);

	useEffect(() => {
		if (!thumbnail) {
			setTrackAccent(null);
			return;
		}
		let cancelled = false;
		void utils.track.accent
			.fetch()
			.then((clr) => {
				if (!cancelled) setTrackAccent(clr || null);
			})
			.catch(() => {
				if (!cancelled) setTrackAccent(null);
			});
		return () => {
			cancelled = true;
		};
		// utils.track.accent identity churns every render — only re-fetch on thumbnail.
		// eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
	}, [thumbnail]);

	const time = useMemo((): { current: string; end: string; pct: number } | null => {
		const progress = playState?.progress;
		const duration = playState?.duration || Number(track?.meta?.duration) || 0;
		if (typeof progress !== "number" || duration <= 0) return null;
		const elapsed = clamp(progress, 0, duration);
		return {
			current: formatTime(elapsed),
			end: formatTime(duration),
			pct: clamp((elapsed / duration) * 100, 0, 100),
		};
	}, [playState?.progress, playState?.duration, track?.meta?.duration]);

	function handleNext() {
		setTrackBusy(true);
		return next()
			.finally(() => setTrackBusy(false))
			.then(() => {
				if (playStateRef.current) patchPlayState(utils, { progress: 0 });
			});
	}

	function handlePrev() {
		setTrackBusy(true);
		return prev().finally(() => {
			setTrackBusy(false);
			if (playStateRef.current) patchPlayState(utils, { progress: 0 });
		});
	}

	function likeToggle() {
		if (typeof playStateRef.current?.liked !== "boolean") return;
		const next = !playStateRef.current.liked;
		patchPlayState(utils, { liked: next, ...(next ? { disliked: false } : {}) });
		setTrackBusy(true);
		return like({ liked: next })
			.then((liked) => {
				if (typeof liked === "boolean") {
					patchPlayState(utils, { liked, ...(liked ? { disliked: false } : {}) });
				}
			})
			.finally(() => setTrackBusy(false));
	}

	function dislikeToggle() {
		if (typeof playStateRef.current?.disliked !== "boolean") return;
		const next = !playStateRef.current.disliked;
		patchPlayState(utils, { disliked: next, ...(next ? { liked: false } : {}) });
		setTrackBusy(true);
		return dislike({ disliked: next })
			.then((disliked) => {
				if (typeof disliked === "boolean") {
					patchPlayState(utils, { disliked, ...(disliked ? { liked: false } : {}) });
				}
			})
			.finally(() => setTrackBusy(false));
	}

	async function handleSettings() {
		await hideTrayView();
		await openSettings();
	}

	async function handlePinToggle() {
		try {
			const applied = await toggleTrayPin();
			utils.trayView.pinned.setData(undefined, applied);
		} catch {
			/* keep last known pin */
		}
	}

	const [seekHovering, setSeekHovering] = useState(false);
	const durationSec = playState?.duration || Number(track?.meta?.duration) || 0;
	const durationSecRef = useRef(durationSec);
	durationSecRef.current = durationSec;
	const currentTimeLabel = time?.current ?? "0:00";

	const seekTrackRef = useRef<HTMLDivElement>(null);
	const seekHoverFillRef = useRef<HTMLDivElement>(null);
	const seekThumbRef = useRef<HTMLDivElement>(null);
	const seekTipRef = useRef<HTMLDivElement>(null);
	const seekTimeRef = useRef<HTMLSpanElement>(null);
	const seekHoveringRef = useRef(false);

	useEffect(() => {
		if (seekHoveringRef.current) return;
		if (seekTimeRef.current) seekTimeRef.current.textContent = currentTimeLabel;
	}, [currentTimeLabel]);

	function syncSeekHover(clientX: number) {
		const trackEl = seekTrackRef.current;
		if (!trackEl) return;
		const rect = trackEl.getBoundingClientRect();
		if (rect.width <= 0) return;
		const pct = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
		const pctStr = `${pct}%`;
		if (seekHoverFillRef.current) seekHoverFillRef.current.style.width = pctStr;
		if (seekThumbRef.current) seekThumbRef.current.style.left = pctStr;
		if (seekTipRef.current) seekTipRef.current.style.left = pctStr;
		const dur = durationSecRef.current;
		const label = dur > 0 ? formatTime((pct / 100) * dur) : "0:00";
		if (seekTipRef.current) seekTipRef.current.textContent = label;
		if (seekTimeRef.current) seekTimeRef.current.textContent = label;
	}

	function handleSeekHover(ev: MouseEvent<HTMLDivElement>) {
		syncSeekHover(ev.clientX);
	}

	function handleSeekEnter(ev: MouseEvent<HTMLDivElement>) {
		seekHoveringRef.current = true;
		setSeekHovering(true);
		requestAnimationFrame(() => syncSeekHover(ev.clientX));
	}

	function clearSeekHover() {
		seekHoveringRef.current = false;
		setSeekHovering(false);
		if (seekTimeRef.current) seekTimeRef.current.textContent = currentTimeLabel;
	}

	function setCurrentTime(ev: MouseEvent<HTMLDivElement>) {
		if (trackBusy) return;
		const current = playStateRef.current;
		if (!current) return;
		const el = ev.currentTarget;
		const rect = el.getBoundingClientRect();
		const percSelected = (ev.clientX - rect.left) / rect.width;
		const duration = current.duration || Number(track?.meta?.duration) || 0;
		if (duration <= 0) return;
		const seekTime = clamp(duration * percSelected, 0, duration) * 1000;
		setTrackBusy(true);
		void seek({ time: seekTime, type: "seek" })
			.then(() => {
				patchPlayState(utils, { progress: seekTime / 1000, duration });
			})
			.finally(() => setTrackBusy(false));
	}

	return (
		<div
			className="absolute inset-0 flex min-h-0 flex-col overflow-hidden border border-border bg-background text-foreground shadow-sm"
			onMouseEnter={(ev) => {
				setContentHovered(true);
				const { left, width } = ev.currentTarget.getBoundingClientRect();
				if (width <= 0) return;
				setHoverThreshold((ev.clientX - left) / width < 1 / 10);
			}}
			onMouseMove={(ev) => {
				const { left, width } = ev.currentTarget.getBoundingClientRect();
				if (width <= 0) return;
				const isInThreshold = (ev.clientX - left) / width < 1 / 10;
				setHoverThreshold((prev) => (prev === isInThreshold ? prev : isInThreshold));
			}}
			onMouseLeave={(ev) => {
				setContentHovered(false);
				if (pointerInsideWindow(ev)) return;
				setHoverThreshold(false);
			}}
		>
			<TrayBleedArt src={artSrc} accent={displayAccent} />

			<div className="relative z-10 flex h-[10.5rem] min-h-0 w-full shrink-0 overflow-hidden">
				<TrayAccentPill accent={displayAccent} drag={pinned} expanded={pinned && leftThirdHovered} />
				<div className="no-drag relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
					<div
						className={cn(
							"no-drag absolute top-2 right-2 z-20 flex items-center gap-0.5 rounded-md bg-background/60 p-0.5 shadow-sm backdrop-blur-sm",
							"transition-[opacity,transform] duration-200 ease-out",
							chromeVisible
								? "pointer-events-auto translate-y-0 opacity-100"
								: "pointer-events-none -translate-y-0.5 opacity-0",
						)}
					>
						<Tooltip onOpenChange={setChromeTooltipOpen}>
							<TooltipTrigger
								render={
									<ChromeButton
										aria-label={pinned ? "Unpin" : "Pin"}
										aria-pressed={pinned}
										onPointerDown={(ev) => {
											if (ev.button !== 0) return;
											ev.preventDefault();
											ev.stopPropagation();
											void handlePinToggle();
										}}
										className={cn("no-drag", pinned && "text-foreground bg-accent/20")}
									>
										<PinIcon className={cn(pinned && "fill-current")} />
									</ChromeButton>
								}
							/>
							<TooltipContent side="bottom">{pinned ? "Unpin" : "Pin"}</TooltipContent>
						</Tooltip>
						<Tooltip onOpenChange={setChromeTooltipOpen}>
							<TooltipTrigger
								render={
									<ChromeButton aria-label="Back to app" onClick={() => void openMain()}>
										<ArrowLeftIcon />
									</ChromeButton>
								}
							/>
							<TooltipContent side="bottom">Back to app</TooltipContent>
						</Tooltip>
						<Tooltip onOpenChange={setChromeTooltipOpen}>
							<TooltipTrigger
								render={
									<ChromeButton aria-label="Settings" onClick={() => void handleSettings()}>
										<SettingsIcon />
									</ChromeButton>
								}
							/>
							<TooltipContent side="bottom">Settings</TooltipContent>
						</Tooltip>
					</div>

					<div className="relative flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-1 overflow-hidden px-3 pt-3 pb-2">
						<div className="flex items-start gap-2.5">
							<TrayCoverArt src={artSrc} />
							<div className="min-w-0 flex-1 pt-0.5">
								<p className="truncate text-base leading-tight font-semibold">{title}</p>
								{artist ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{artist}</p> : null}
							</div>
						</div>

						<div className="flex items-center gap-2">
							<span
								ref={seekTimeRef}
								className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground/40"
							/>
							<div
								ref={seekTrackRef}
								className={cn(
									"group relative h-1.5 min-w-0 flex-1 cursor-pointer rounded-full bg-muted/80",
									!track && "pointer-events-none opacity-40",
								)}
								onClick={setCurrentTime}
								onMouseMove={handleSeekHover}
								onMouseEnter={handleSeekEnter}
								onMouseLeave={clearSeekHover}
								role="slider"
								aria-label="Seek"
								aria-valuenow={time?.pct ?? 0}
								aria-valuemin={0}
								aria-valuemax={100}
								tabIndex={0}
							>
								{/* Played */}
								<div
									className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-100 ease-out"
									style={{
										width: `${time?.pct ?? 0}%`,
										...(displayAccent ? { backgroundColor: displayAccent } : {}),
									}}
								/>
								{/* Hover preview — imperative width, no transition */}
								<div
									ref={seekHoverFillRef}
									className={cn("absolute inset-y-0 left-0 rounded-full bg-foreground/25", !seekHovering && "hidden")}
									style={{ width: 0 }}
								/>
								{/* Scrubber thumb + tip — follow cursor via refs */}
								<div
									ref={seekThumbRef}
									className={cn(
										"pointer-events-none absolute top-1/2 z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-sm ring-2 ring-background",
										!seekHovering && "hidden",
									)}
									style={{ left: 0 }}
								/>
								<div
									ref={seekTipRef}
									className={cn(
										"pointer-events-none absolute bottom-full z-20 mb-1.5 -translate-x-1/2 rounded-md bg-foreground px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-background shadow-sm",
										!seekHovering && "hidden",
									)}
									style={{ left: 0 }}
								/>
							</div>
							<span className="w-9 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">{time?.end ?? "0:00"}</span>
						</div>

						<div className="flex shrink-0 justify-center pt-1">
							<div className="flex items-center gap-0.5 rounded-full border border-border/50 bg-background/50 p-1 shadow-sm backdrop-blur-md">
								{hasLike ? (
									<PlayerButton
										active={!!playState?.liked}
										disabled={trackBusy || !track}
										aria-label="Like"
										style={
											playState?.liked && displayAccent
												? { color: displayAccent }
												: undefined
										}
										onClick={likeToggle}
									>
										<LikeIcon />
									</PlayerButton>
								) : null}
								<PlayerButton disabled={trackBusy || !track} aria-label="Previous" onClick={handlePrev}>
									<PrevIcon />
								</PlayerButton>
								<PlayerButton
									variant="hero"
									disabled={trackBusy || !track}
									aria-label={playing ? "Pause" : "Play"}
									style={
										displayAccent
											? {
													backgroundColor: `color-mix(in oklab, ${displayAccent} 28%, transparent)`,
													color: displayAccent,
												}
											: undefined
									}
									onClick={() => void (!playing ? play() : pause())}
								>
									{playing ? <PauseIcon /> : <PlayIcon />}
								</PlayerButton>
								<PlayerButton disabled={trackBusy || !track} aria-label="Next" onClick={handleNext}>
									<NextIcon />
								</PlayerButton>
								{hasDislike ? (
									<PlayerButton
										active={!!playState?.disliked}
										disabled={trackBusy || !track}
										aria-label="Dislike"
										style={
											playState?.disliked && displayAccent
												? { color: displayAccent }
												: undefined
										}
										onClick={dislikeToggle}
									>
										<LikeIcon className="rotate-180" />
									</PlayerButton>
								) : null}
								<span className="mx-0.5 h-4 w-px shrink-0 bg-foreground/20" aria-hidden />
								<TrayVolumeControl accent={displayAccent} disabled={trackBusy} />
								<PlayerButton
									active={queueOpen}
                  style={
                    queueOpen && displayAccent
                      ? { color: displayAccent }
                      : undefined
                  }
									aria-label={queueOpen ? "Close queue" : "Queue"}
									onClick={() => void setQueueVisible(!queueOpen)}
								>
									<ListMusicIcon />
								</PlayerButton>
							</div>
						</div>
					</div>
				</div>
			</div>
			{queueOpen ? (
				<TrayQueueList
					currentVideoId={track?.video?.videoId}
					counterpartVideoId={track?.meta?.counterpartVideoId}
					accent={displayAccent}
					playing={playing}
				/>
			) : null}
		</div>
	);
}
