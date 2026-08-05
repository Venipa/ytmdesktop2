import type { TrackData } from "@shared/track/trackData";
import { createFileRoute } from "@tanstack/react-router";
import { cva, type VariantProps } from "class-variance-authority";
import { intervalToDuration } from "date-fns";
import { clamp } from "lodash-es";
import { AlertCircleIcon, CheckIcon } from "lucide-react";
import { type ButtonHTMLAttributes, type CSSProperties, type MouseEvent, useCallback, useMemo, useRef, useState } from "react";
import BackwardIcon from "@/assets/icons/backward10.svg?react";
import ForwardIcon from "@/assets/icons/forward10.svg?react";
import LastFMIcon from "@/assets/icons/lastfm.svg?react";
import LikeIcon from "@/assets/icons/like.svg?react";
import LockIcon from "@/assets/icons/lock.svg?react";
import MiniPlayerIcon from "@/assets/icons/mini-player.svg?react";
import NextIcon from "@/assets/icons/next.svg?react";
import PauseIcon from "@/assets/icons/pause.svg?react";
import PlayIcon from "@/assets/icons/play.svg?react";
import PrevIcon from "@/assets/icons/prev.svg?react";
import UnLockIcon from "@/assets/icons/unlock.svg?react";
import { ControlBar } from "@/components/control-bar";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLastFm } from "@/hooks/use-lastfm";
import { useWindowState } from "@/hooks/use-settings";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/miniplayer")({
	component: MiniPlayerPage,
});

interface PlayState {
	playing: boolean;
	progress: number;
	duration: number;
	liked: boolean;
	disliked: boolean;
}

const playerButtonVariants = cva(
	[
		"inline-flex shrink-0 cursor-pointer items-center justify-center text-zinc-200 transition-all duration-100 ease-in-out",
		"disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 disabled:transform-none",
		"[&_svg]:pointer-events-none [&_svg]:shrink-0",
	].join(" "),
	{
		variants: {
			variant: {
				default: [
					"size-10 rounded-lg p-2",
					"enabled:hover:bg-zinc-50/5",
					"enabled:active:scale-95 enabled:active:bg-zinc-50/10",
					"data-[active=true]:[&_svg]:fill-current data-[active=true]:[&_svg_path]:stroke-inherit",
				].join(" "),
				hero: [
					"mx-auto size-10 shrink-0 rounded-full border border-zinc-600 shadow-sm",
					"enabled:active:scale-95 enabled:active:border-zinc-50/90",
					"[&_svg]:size-6",
				].join(" "),
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

type PlayerButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
	VariantProps<typeof playerButtonVariants> & {
		active?: boolean;
	};

function PlayerButton({ className, variant, active, type = "button", ...props }: PlayerButtonProps) {
	return (
		<button
			type={type}
			data-active={active ? "true" : undefined}
			className={cn(playerButtonVariants({ variant }), className)}
			{...props}
		/>
	);
}

const zeroPad = (num: number | undefined): string => String(num ?? 0).padStart(2, "0");

const createInterval = (dts: (number | undefined)[]): [string, number] => [
	dts
		.filter((p, i) => (i === 0 ? Boolean(p) : true))
		.map(zeroPad)
		.join(":"),
	dts.length,
];

function MiniPlayerPage() {
	const utils = trpc.useUtils();
	const [track, setTrack] = useState<TrackData | null>(null);
	const [playState, setPlayState] = useState<PlayState | undefined>();
	const [state] = useWindowState();
	const { lastFM, lastFMLoading, lastFMState, authorizeLastFM } = useLastFm();

	const [accentColor, setAccentColor] = useState<string | null>(null);
	const [trackBusy, setTrackBusy] = useState(false);
	const [stayOnTopLocal, setStayOnTopLocal] = useState<boolean | undefined>();

	const progressHandleRef = useRef<HTMLDivElement>(null);
	const accentHandleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const playStateRef = useRef(playState);
	playStateRef.current = playState;

	document.title = "YouTube Music - Mini Player";

	const { data: isWin11 } = trpc.app.isWin11.useQuery();
	const { data: isStayOnTop } = trpc.window.isStayOnTop.useQuery();

	const { mutateAsync: next } = trpc.track.next.useMutation();
	const { mutateAsync: prev } = trpc.track.prev.useMutation();
	const { mutateAsync: forward } = trpc.track.forward.useMutation();
	const { mutateAsync: backward } = trpc.track.backward.useMutation();
	const { mutateAsync: pause } = trpc.track.pause.useMutation();
	const { mutateAsync: play } = trpc.track.play.useMutation();
	const { mutateAsync: dislike } = trpc.track.dislike.useMutation();
	const { mutateAsync: like } = trpc.track.like.useMutation();
	const { mutateAsync: seek } = trpc.track.seek.useMutation();
	const { mutateAsync: stayOnTop } = trpc.window.stayOnTop.useMutation();

	trpc.track.current.useQuery(undefined, {
		onSuccess: (trackData) => setTrack((trackData as TrackData | null) ?? null),
	});
	trpc.track.onTrack.useSubscription(undefined, {
		onData: (trackData) => setTrack((trackData as TrackData | null) ?? null),
	});
	trpc.track.state.useQuery(undefined, {
		onSuccess: (playStateData) => {
			if (playStateData) setPlayState(playStateData as PlayState);
		},
	});
	trpc.track.onPlayState.useSubscription(undefined, {
		onData: (playStateData) => {
			if (playStateData) setPlayState(playStateData as PlayState);
		},
	});

	const isTop = stayOnTopLocal ?? !!isStayOnTop;
	const showWinBorder = useMemo((): boolean | "win11" => {
		if (window.app.platform === "win32") {
			if (isWin11 === undefined) return false;
			return isWin11 ? "win11" : true;
		}
		return !!state?.platform?.isMacOS;
	}, [isWin11, state?.platform?.isMacOS]);

	const getCurrentAccent = useCallback(
		(retry = 0) => {
			if (accentHandleRef.current) clearTimeout(accentHandleRef.current);
			utils.track.accent.fetch().then((clr) => {
				if (!clr || retry > 2) setAccentColor(clr || null);
				else setAccentColor(clr);
				if (!clr) accentHandleRef.current = setTimeout(() => getCurrentAccent(retry + 1), 500);
			});
		},
		[utils],
	);

	function handleNext() {
		setTrackBusy(true);
		return next()
			.finally(() => {
				setTrackBusy(false);
			})
			.then(() => {
				if (playStateRef.current) setPlayState({ ...playStateRef.current, progress: 0 });
			});
	}

	function handlePrev() {
		setTrackBusy(true);
		return prev().finally(() => {
			setTrackBusy(false);
			if (playStateRef.current) setPlayState({ ...playStateRef.current, progress: 0 });
		});
	}

	function handleForward(time = 10000) {
		setTrackBusy(true);
		return forward({ time }).finally(() => {
			setTrackBusy(false);
		});
	}

	function handleBackward(time = 10000) {
		setTrackBusy(true);
		return backward({ time }).finally(() => {
			setTrackBusy(false);
		});
	}

	function dislikeToggle() {
		if (typeof playStateRef.current?.disliked !== "boolean") return;
		setTrackBusy(true);
		return dislike(!playStateRef.current.disliked).finally(() => {
			setTrackBusy(false);
		});
	}

	function likeToggle() {
		if (typeof playStateRef.current?.liked !== "boolean") return;
		setTrackBusy(true);
		return like(!playStateRef.current.liked).finally(() => {
			setTrackBusy(false);
		});
	}

	const handleAccent = useCallback(
		(ev: React.SyntheticEvent<HTMLImageElement>) => {
			const src = ev.currentTarget.src;
			if (src) getCurrentAccent();
		},
		[getCurrentAccent],
	);

	function setCurrentTime(ev: MouseEvent<HTMLDivElement>) {
		if (trackBusy) return;
		const current = playStateRef.current;
		if (!current) return;
		const el = ev.currentTarget;
		const percSelected = ev.clientX / el.clientWidth;
		const duration = current.duration || Number(track?.meta?.duration) || 0;
		if (duration <= 0) return;
		const seekTime = clamp(duration * percSelected, 0, duration) * 1000;
		setTrackBusy(true);
		void seek({ time: seekTime, type: "seek" })
			.then(() => {
				setPlayState({ ...current, progress: seekTime / 1000, duration });
			})
			.finally(() => {
				setTrackBusy(false);
			});
	}

	async function toggleStayTop() {
		const result = await stayOnTop();
		setStayOnTopLocal(result);
	}

	const thumbnail = track?.meta?.thumbnail;
	const playing = !!playState?.playing;

	const time = useMemo((): [string, string, number] | null => {
		const progress = playState?.progress;
		const duration = playState?.duration || Number(track?.meta?.duration) || 0;
		if (typeof progress !== "number" || duration <= 0) return null;
		const elapsed = Math.max(0, Math.min(Math.floor(progress), Math.floor(duration)));
		const [current] = (({ hours, minutes, seconds }) => createInterval([hours, minutes, seconds]))(
			intervalToDuration({ start: 0, end: elapsed * 1000 }),
		);
		const [end, endPad] = (({ hours, minutes, seconds }) => createInterval([hours, minutes, seconds]))(
			intervalToDuration({ start: 0, end: duration * 1000 }),
		) as [string, number];
		const timePad = endPad * 2;
		const percentage = (elapsed / duration) * 100;
		return [current.padEnd(timePad), end.padStart(timePad), percentage];
	}, [playState, track?.meta?.duration]);

	const rootStyle = useMemo((): CSSProperties => {
		const style: CSSProperties = {};
		if (accentColor && showWinBorder) {
			style.borderWidth = showWinBorder === "win11" ? "2.5px" : "1px";
			style.borderStyle = "solid";
			style.borderColor = accentColor;
		}
		if (accentColor) {
			if (state.maximized || state.fullScreen || state.y === 0) {
				style.borderRadius = "0px";
				style.borderWidth = "0px";
			} else if (showWinBorder === "win11") {
				style.borderRadius = "8px";
			} else if (state.platform?.isMacOS) {
				style.borderRadius = "12px";
			} else {
				style.borderRadius = "6px";
			}
		}
		return style;
	}, [accentColor, showWinBorder, state]);

	return (
		<div className="absolute inset-0 flex h-full flex-col overflow-hidden bg-black" style={rootStyle}>
			<style>{`
				.track-status-time { min-width: 40px; }
				.fill-icon svg { fill: currentColor; }
				.fill-icon svg path { stroke: transparent; }
				.track-thumbnail {
					flex: none; border-radius: 0.5rem; background-color: rgb(39 39 42);
					height: calc(100vh - 10rem); width: calc(100vh - 10rem);
					max-width: calc(100vw - 16rem); max-height: calc(100vw - 16rem);
				}
				.track-thumbnail img { object-fit: cover; object-position: center; }
			`}</style>

			<div className="absolute inset-0">
				{thumbnail && accentColor && (
					<div className="absolute inset-0 opacity-[.25]" style={{ backgroundColor: accentColor }} />
				)}
				{thumbnail && (
					<div
						className="absolute inset-0 scale-125 bg-cover bg-center bg-no-repeat opacity-[.25] blur-[8px]"
						style={{ backgroundImage: `url(${thumbnail})` }}
					/>
				)}
			</div>

			<div className="absolute inset-x-0 top-0 z-30">
				<ControlBar
					title="Mini Player"
					icon={<MiniPlayerIcon className="antialiased" />}
					className="border-b-0 bg-transparent pl-4 text-zinc-50 [&_.drag]:text-zinc-50 [&>div>div]:text-zinc-50"
					divider={
						<Tooltip>
							<TooltipTrigger
								render={
									<button
										type="button"
										className="control-button"
										aria-label={isTop ? "Disable stay on top" : "Stay on top"}
										onClick={() => void toggleStayTop()}
									>
										{isTop ? <LockIcon /> : <UnLockIcon className="opacity-70" />}
									</button>
								}
							/>
							<TooltipContent side="bottom">{isTop ? "Disable stay on top" : "Stay on top"}</TooltipContent>
						</Tooltip>
					}
				/>
				<div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 bg-linear-to-b from-black/60 to-transparent" />
			</div>

			<div className="relative z-10 flex min-h-0 flex-1 flex-col pt-10">
				<div className="centeronscreen relative z-10 flex flex-1 flex-col justify-center px-6">
					<div className="flex items-start space-x-6">
						<div className="track-thumbnail relative flex flex-shrink-0 items-center justify-center shadow">
							{trackBusy && (
								<div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-[inherit]">
									<div className="absolute inset-0 z-[1] bg-black/50" />
									<div
										className="absolute inset-0 z-[2] bg-zinc-800/80"
										style={accentColor ? { backgroundColor: `${accentColor}20` } : undefined}
									/>
									<Spinner className="z-[5] size-8" />
								</div>
							)}
							{thumbnail ? (
								<>
									{accentColor && (
										<div
											className="absolute inset-0 z-[1] rounded-[inherit]"
											style={{
												boxShadow: `10px 12px 12px -2px ${accentColor}50, 0 0 0 .1rem ${accentColor}`,
											}}
										/>
									)}
									{accentColor && (
										<div
											className="absolute -inset-2 z-[2] rounded-xl"
											style={{
												backgroundImage: `linear-gradient(${accentColor}a0, ${accentColor}00, ${accentColor}10, ${accentColor}f0)`,
											}}
										/>
									)}
									<div className="absolute inset-0 overflow-hidden rounded-[inherit]">
										<img
											className="absolute inset-0 z-[5] h-full w-full scale-[1.12] object-cover object-center opacity-[.5] blur-[4px]"
											src={thumbnail}
											alt=""
											loading="lazy"
											onLoad={handleAccent}
										/>
									</div>
									<img
										src={thumbnail}
										alt=""
										className="z-[6] w-full rounded-[inherit] object-contain object-center"
										loading="lazy"
									/>
								</>
							) : (
								<div className="absolute inset-0 flex items-center justify-center rounded-[inherit]">
									<MiniPlayerIcon
										className="h-24 w-24 text-zinc-50 md:h-40 md:w-40"
										style={accentColor ? { color: accentColor } : undefined}
									/>
								</div>
							)}
						</div>

						<div className="flex h-full flex-1 truncate flex-col">
							{track?.video && (
								<div className="min-w-0 flex-auto space-y-1 truncate font-semibold">
									<h2 className="truncate text-lg text-zinc-50">{track.video.title}</h2>
									<p className="truncate text-sm leading-6 text-zinc-400 md:text-base lg:text-lg">
										{" "}
										by {track.video.author}{" "}
									</p>
									{time && (
										<div className="flex items-center space-x-1 whitespace-pre text-sm text-zinc-400">
											<p className="track-status-time tabular-nums">{time[0]}</p>
											<span>/</span>
											<p className="track-status-time tabular-nums">{time[1]}</p>
										</div>
									)}
								</div>
							)}
							<div className="mt-auto flex flex-shrink-0 items-center space-x-2">
								{playState?.disliked !== undefined && (
									<PlayerButton
										active={!!playState?.disliked}
										disabled={trackBusy}
										aria-label="Dislike"
										style={
											accentColor && !!playState?.disliked
												? { color: accentColor, stroke: "#fff" }
												: undefined
										}
										onClick={dislikeToggle}
									>
										<LikeIcon className="rotate-180" />
									</PlayerButton>
								)}
								{playState?.liked !== undefined && (
									<PlayerButton
										active={!!playState?.liked}
										disabled={trackBusy}
										aria-label="Like"
										style={
											accentColor && !!playState?.liked
												? { color: accentColor, stroke: "#fff" }
												: undefined
										}
										onClick={likeToggle}
									>
										<LikeIcon />
									</PlayerButton>
								)}
								{lastFM.connected && (
									<PlayerButton
										className="relative size-8 p-1"
										disabled={lastFMLoading || trackBusy}
										aria-label="Last.fm"
										onClick={authorizeLastFM}
									>
										{lastFM.connected && !lastFM.error && lastFMState !== null ? (
											typeof lastFMState === "string" ? (
												<Spinner className="size-3" />
											) : lastFMState === true ? (
												<CheckIcon className="text-green-500" />
											) : lastFMState === false ? (
												<AlertCircleIcon className="text-red-500" />
											) : null
										) : (
											<LastFMIcon
												className={cn(
													lastFM.connected && !lastFM.error && "text-green-500",
													lastFM.error && "text-red-500",
												)}
											/>
										)}
									</PlayerButton>
								)}
							</div>
						</div>
					</div>
				</div>

				<div className="relative z-10 flex flex-col">
					{time && (
						<div className="group -mt-4 cursor-pointer pt-4" onClick={setCurrentTime}>
							<div
								ref={progressHandleRef}
								className="h-1 bg-white transition-all duration-150 ease-in-out group-hover:h-2"
								style={{
									width: `${time[2]}%`,
									maxWidth: "100%",
									...(accentColor ? { backgroundColor: accentColor } : {}),
								}}
							/>
						</div>
					)}
					<div className="mt-auto flex h-16 items-center bg-zinc-50/5 text-zinc-200">
						<div className="flex flex-auto items-center justify-evenly">
							<PlayerButton disabled={trackBusy} aria-label="Previous" onClick={handlePrev}>
								<PrevIcon />
							</PlayerButton>
							<PlayerButton disabled={trackBusy} aria-label="Rewind 10 seconds" onClick={() => void handleBackward()}>
								<BackwardIcon />
							</PlayerButton>
						</div>
						<PlayerButton
							variant="hero"
							style={accentColor ? { borderColor: accentColor } : undefined}
							aria-label={playing ? "Pause" : "Play"}
							disabled={trackBusy}
							onClick={() => void (!playing ? play() : pause())}
						>
							<div className="fill-icon fill-zinc-700">{playing ? <PauseIcon /> : <PlayIcon />}</div>
						</PlayerButton>
						<div className="flex flex-auto items-center justify-evenly">
							<PlayerButton disabled={trackBusy} aria-label="Skip 10 seconds" onClick={() => void handleForward()}>
								<ForwardIcon />
							</PlayerButton>
							<PlayerButton disabled={trackBusy} aria-label="Next" onClick={handleNext}>
								<NextIcon />
							</PlayerButton>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
