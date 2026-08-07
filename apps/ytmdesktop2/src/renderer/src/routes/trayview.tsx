import { toAppThumbUrl } from "@shared/media/appThumbUrl";
import { createFileRoute } from "@tanstack/react-router";
import { cva } from "class-variance-authority";
import { intervalToDuration } from "date-fns";
import { clamp } from "lodash-es";
import { ArrowLeftIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ButtonHTMLAttributes, type MouseEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ApiIcon from "@/assets/icons/chip.svg?react";
import DiscordIcon from "@/assets/icons/discord-rpc.svg?react";
import LastFMIcon from "@/assets/icons/lastfm.svg?react";
import LikeIcon from "@/assets/icons/like.svg?react";
import NextIcon from "@/assets/icons/next.svg?react";
import PauseIcon from "@/assets/icons/pause.svg?react";
import PlayIcon from "@/assets/icons/play.svg?react";
import PrevIcon from "@/assets/icons/prev.svg?react";
import SettingsIcon from "@/assets/icons/settings.svg?react";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDiscord } from "@/hooks/use-discord";
import { useLastFm } from "@/hooks/use-lastfm";
import { useSettingsState } from "@/hooks/use-settings";
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

function TrayAccentPill({ accent }: { accent: string | null }) {
	return (
		<div className="relative z-10 flex w-3 shrink-0 items-stretch justify-center py-2.5 ml-1" aria-hidden>
			<motion.div
				className="w-1.5 rounded-full bg-accent"
				initial={false}
				animate={{ backgroundColor: accent ?? "var(--accent)" }}
				transition={{ duration: ART_DURATION, ease: ART_EASE }}
			/>
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
						draggable={false}
						className="absolute inset-0 size-full object-cover"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: ART_DURATION, ease: ART_EASE }}
					/>
				) : (
					<motion.div
						key="empty-cover"
						className="absolute inset-0 flex size-full items-center justify-center text-[9px] font-medium tracking-wide text-muted-foreground"
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

const controlToggleVariants = cva(
	[
		"relative inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-[transform,background-color,color,opacity] duration-100",
		"enabled:hover:bg-accent/15 enabled:hover:text-foreground enabled:active:scale-95",
		"disabled:pointer-events-none disabled:opacity-40",
		"[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
		"data-[on=true]:bg-accent/20 data-[on=true]:text-foreground",
	].join(" "),
	{ variants: { variant: { default: "" } }, defaultVariants: { variant: "default" } },
);

function ChromeButton({ className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
	return <button type={type} className={cn(chromeButtonVariants(), className)} {...props} />;
}

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

function ControlToggle({
	className,
	active,
	busy,
	type = "button",
	children,
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; busy?: boolean }) {
	return (
		<button type={type} data-on={active ? "true" : undefined} className={cn(controlToggleVariants(), className)} {...props}>
			{children}
			{busy ? (
				<span className="absolute -top-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full bg-muted">
					<Spinner className="size-2" />
				</span>
			) : active ? (
				<span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-green-500 ring-2 ring-background" />
			) : null}
		</button>
	);
}

function TrayViewPage() {
	const utils = trpc.useUtils();
	const track = useTrack();
	const playState = useTrackState();
	const [trackBusy, setTrackBusy] = useState(false);
	const [trackAccent, setTrackAccent] = useState<string | null>(null);
	const playStateRef = useRef(playState);
	playStateRef.current = playState;

	const { enabled: lastFmEnabled, toggleLastFM, lastFM, lastFMLoading, isBusy: lastFmBusy } = useLastFm();
	const { enabled: discordEnabled, toggle: toggleDiscord, loading: discordLoading, connected: discordConnected, error: discordError } = useDiscord();
	const [apiEnabled, setApiEnabled] = useSettingsState<boolean>("api.enabled", false);

	const { mutateAsync: next } = trpc.track.next.useMutation();
	const { mutateAsync: prev } = trpc.track.prev.useMutation();
	const { mutateAsync: pause } = trpc.track.pause.useMutation();
	const { mutateAsync: play } = trpc.track.play.useMutation();
	const { mutateAsync: seek } = trpc.track.seek.useMutation();
	const { mutateAsync: like } = trpc.track.like.useMutation();
	const { mutateAsync: dislike } = trpc.track.dislike.useMutation();
	const { mutateAsync: hideTrayView } = trpc.trayView.hide.useMutation();
	const { mutateAsync: openMain } = trpc.trayView.openMain.useMutation();
	const { mutateAsync: openSettings } = trpc.app.openSettings.useMutation();

	useEffect(() => {
		document.title = "YouTube Music - Tray";
	}, []);

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
		<div className="absolute inset-0 flex overflow-hidden border border-border bg-background text-foreground shadow-sm">
			<TrayBleedArt src={artSrc} accent={displayAccent} />
			<TrayAccentPill accent={displayAccent} />

			<div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
				<div className="relative z-10 flex min-h-0 flex-1">
					{/* Player column */}
					<div className="flex min-w-0 flex-1 flex-col px-3 pt-3 pb-2">
						<div className="flex items-start gap-2.5">
							<TrayCoverArt src={artSrc} />

							<div className="min-w-0 flex-1 pt-0.5">
								<p className="truncate text-base leading-tight font-semibold">{title}</p>
								{artist ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{artist}</p> : null}
							</div>

							<div className="flex shrink-0 items-center gap-0.5">
								<Tooltip>
									<TooltipTrigger
										render={
											<ChromeButton aria-label="Back to app" onClick={() => void openMain()}>
												<ArrowLeftIcon />
											</ChromeButton>
										}
									/>
									<TooltipContent side="bottom">Back to app</TooltipContent>
								</Tooltip>
								<Tooltip>
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
						</div>

						{/* Progress + duration */}
						<div className="mt-3 flex items-center gap-2">
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

						{/* Transport — segmented dock */}
						<div className="mt-auto flex justify-center pt-2">
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
							</div>
						</div>
					</div>

					{/* Control center column */}
					<div className="relative z-10 flex w-12 shrink-0 flex-col items-center justify-center gap-1.5 border-l border-border/60 bg-background/40 px-1.5 py-2 backdrop-blur-sm">
						<Tooltip>
							<TooltipTrigger
								render={
									<ControlToggle
										active={lastFmEnabled}
										busy={lastFmBusy || lastFMLoading}
										aria-label={lastFmEnabled ? "Disable Last.fm" : "Enable Last.fm"}
										onClick={() => void toggleLastFM(!lastFmEnabled)}
									>
										<LastFMIcon
											className={cn(
												lastFmEnabled && lastFM.error && "text-red-500",
												lastFmEnabled && lastFM.connected && !lastFM.error && "text-green-500",
											)}
										/>
									</ControlToggle>
								}
							/>
							<TooltipContent side="left">
								{lastFmEnabled ? (lastFM.name ? `Last.fm · ${lastFM.name}` : "Last.fm on") : "Last.fm off"}
							</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger
								render={
									<ControlToggle
										active={discordEnabled}
										busy={discordLoading}
										aria-label={discordEnabled ? "Disable Discord" : "Enable Discord"}
										onClick={toggleDiscord}
									>
										<DiscordIcon className={cn(discordEnabled && discordError && "text-red-500")} />
									</ControlToggle>
								}
							/>
							<TooltipContent side="left">
								{discordError && discordEnabled
									? `Discord · ${discordError}`
									: discordEnabled
										? discordConnected
											? "Discord on"
											: "Discord connecting…"
										: "Discord off"}
							</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger
								render={
									<ControlToggle
										active={apiEnabled}
										aria-label={apiEnabled ? "Disable Local API" : "Enable Local API"}
										onClick={() => setApiEnabled((prev) => !prev)}
									>
										<ApiIcon />
									</ControlToggle>
								}
							/>
							<TooltipContent side="left">{apiEnabled ? "Local API on" : "Local API off"}</TooltipContent>
						</Tooltip>
					</div>
				</div>
			</div>
		</div>
	);
}
