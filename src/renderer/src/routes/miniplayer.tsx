import type { TrackData } from "@shared/track/trackData";
import { logger } from "@shared/utils/console";
import { createFileRoute } from "@tanstack/react-router";
import { intervalToDuration } from "date-fns";
import { clamp } from "lodash-es";
import { AlertCircleIcon, CheckIcon } from "lucide-react";
import { type CSSProperties, type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
	const [showWinBorder, setShowWinBorder] = useState<boolean | "win11">(false);
	const [trackBusy, setTrackBusy] = useState(false);
	const [isTop, setIsTop] = useState(false);

	const progressHandleRef = useRef<HTMLDivElement>(null);
	const accentHandleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const playStateRef = useRef(playState);
	playStateRef.current = playState;

	const { data: isWin11 } = trpc.app.isWin11.useQuery();
	const { data: stayTop } = trpc.window.isStayOnTop.useQuery();

	const nextMutation = trpc.track.next.useMutation();
	const prevMutation = trpc.track.prev.useMutation();
	const forwardMutation = trpc.track.forward.useMutation();
	const backwardMutation = trpc.track.backward.useMutation();
	const pauseMutation = trpc.track.pause.useMutation();
	const playMutation = trpc.track.play.useMutation();
	const dislikeMutation = trpc.track.dislike.useMutation();
	const likeMutation = trpc.track.like.useMutation();
	const seekMutation = trpc.track.seek.useMutation();
	const stayOnTopMutation = trpc.window.stayOnTop.useMutation();

	trpc.track.current.useQuery(undefined, {
		onSuccess: (trackData) => setTrack(trackData as TrackData | null),
	});
	trpc.track.onTrack.useSubscription(undefined, {
		onData: (trackData) => setTrack((trackData as TrackData | null) ?? null),
	});
	trpc.track.state.useQuery(undefined, {
		onSuccess: (playStateData) => setPlayState(playStateData as PlayState),
	});
	trpc.track.onPlayState.useSubscription(undefined, {
		onData: (playStateData) => setPlayState(playStateData as PlayState),
	});

	useEffect(() => {
		document.title = "YouTube Music - Mini Player";
	}, []);

	useEffect(() => {
		if (isWin11 === undefined) return;
		setShowWinBorder(window.process.platform === "win32" ? (isWin11 ? "win11" : true) : !!state?.platform?.isMacOS);
	}, [isWin11, state?.platform?.isMacOS]);

	useEffect(() => {
		if (stayTop !== undefined) setIsTop(stayTop);
	}, [stayTop]);

	useEffect(() => {
		logger.debug(state && { ...state });
	}, [state]);

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

	const next = useCallback(() => {
		setTrackBusy(true);
		return nextMutation
			.mutateAsync()
			.finally(() => {
				setTrackBusy(false);
			})
			.then(() => {
				if (playStateRef.current) setPlayState({ ...playStateRef.current, progress: 0 });
			});
	}, [nextMutation]);

	const prev = useCallback(() => {
		setTrackBusy(true);
		return prevMutation.mutateAsync().finally(() => {
			setTrackBusy(false);
			if (playStateRef.current) setPlayState({ ...playStateRef.current, progress: 0 });
		});
	}, [prevMutation]);

	const forward = useCallback(
		(time = 10000) => {
			setTrackBusy(true);
			return forwardMutation.mutateAsync({ time }).finally(() => {
				setTrackBusy(false);
			});
		},
		[forwardMutation],
	);

	const backward = useCallback(
		(time = 10000) => {
			setTrackBusy(true);
			return backwardMutation.mutateAsync({ time }).finally(() => {
				setTrackBusy(false);
			});
		},
		[backwardMutation],
	);

	const pause = useCallback(() => {
		return pauseMutation.mutateAsync();
	}, [pauseMutation]);

	const play = useCallback(() => {
		return playMutation.mutateAsync();
	}, [playMutation]);

	const dislikeToggle = useCallback(() => {
		if (typeof playStateRef.current?.disliked !== "boolean") return;
		setTrackBusy(true);
		return dislikeMutation.mutateAsync(!playStateRef.current.disliked).finally(() => {
			setTrackBusy(false);
		});
	}, [dislikeMutation]);

	const likeToggle = useCallback(() => {
		if (typeof playStateRef.current?.liked !== "boolean") return;
		setTrackBusy(true);
		return likeMutation.mutateAsync(!playStateRef.current.liked).finally(() => {
			setTrackBusy(false);
		});
	}, [likeMutation]);

	const handleAccent = useCallback(
		(ev: React.SyntheticEvent<HTMLImageElement>) => {
			const src = ev.currentTarget.src;
			if (src) getCurrentAccent();
		},
		[getCurrentAccent],
	);

	const setCurrentTime = useCallback(
		(ev: MouseEvent<HTMLDivElement>) => {
			if (trackBusy) return;
			const current = playStateRef.current;
			if (!current) return;
			const el = ev.currentTarget;
			const percSelected = ev.clientX / el.clientWidth;
			const { duration } = current;
			const seekTime = clamp(duration * percSelected, 0, duration) * 1000;
			console.log({
				percentage: percSelected,
				value: seekTime / 1000,
				duration,
			});
			setTrackBusy(true);
			return seekMutation.mutateAsync({ time: seekTime, type: "seek" }).finally(() => {
				setTrackBusy(false);
			});
		},
		[trackBusy, seekMutation],
	);

	const toggleStayTop = useCallback(async () => {
		const result = await stayOnTopMutation.mutateAsync();
		setIsTop(result);
	}, [stayOnTopMutation]);

	const thumbnail = track?.meta?.thumbnail;
	const playing = !!playState?.playing;

	const time = useMemo((): [string, string, number] | null => {
		const { duration, progress } = playState ?? {};
		if (typeof duration !== "number" || typeof progress !== "number") return null;
		const [current] = (({ hours, minutes, seconds }) => createInterval([hours, minutes, seconds]))(
			intervalToDuration({
				start: duration * 1000 - (progress > duration ? duration : Math.floor(progress)) * 1000,
				end: duration * 1000,
			}),
		);
		const [end, endPad] = (({ hours, minutes, seconds }) => createInterval([hours, minutes, seconds]))(
			intervalToDuration({ start: 0, end: duration * 1000 }),
		) as [string, number];
		const timePad = endPad * 2;
		const percentage = ((progress > duration ? duration : progress) / duration) * 100;
		return [current.padEnd(timePad), end.padStart(timePad), percentage];
	}, [playState]);

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
				.player-btn {
					height: 2.5rem; width: 2.5rem; color: rgb(228 228 231); padding: 0.5rem; cursor: pointer;
					display: flex; align-items: center; justify-content: center; border-radius: 0.5rem;
					transition: all 100ms ease-in-out;
				}
				.player-btn:hover { background-color: rgb(250 250 250 / 0.05); }
				.player-btn:active { transform: scale(0.95); background-color: rgb(250 250 250 / 0.1); }
				.player-btn:disabled, .player-btn.disabled { opacity: 0.6; transform: scale(1); }
				.player-btn.active svg { fill: currentColor; }
				.player-btn.active svg path { stroke: inherit; }
				.player-btn-hero {
					border: 1px solid rgb(82 82 91); color: rgb(228 228 231); flex: none; margin-left: auto; margin-right: auto;
					width: 2.5rem; height: 2.5rem; border-radius: 9999px; box-shadow: 0 0 0 1px rgb(24 24 27 / 0.05), 0 4px 6px -1px rgb(0 0 0 / 0.1);
					display: flex; align-items: center; justify-content: center; transition: all 100ms ease-in-out;
				}
				.player-btn-hero svg { height: 1.5rem; width: 1.5rem; }
				.player-btn-hero:disabled, .player-btn-hero.disabled { opacity: 0.6; transform: scale(1); }
				.player-btn-hero:active { transform: scale(0.95); border-color: rgb(250 250 250 / 0.9); }
				.fill-icon svg { fill: currentColor; }
				.fill-icon svg path { stroke: transparent; }
				.track-thumbnail {
					flex: none; border-radius: 0.5rem; background-color: rgb(39 39 42);
					height: calc(100vh - 10rem); width: calc(100vh - 10rem);
					max-width: calc(100vw - 16rem); max-height: calc(100vw - 16rem);
				}
				.track-thumbnail img { object-fit: cover; object-position: center; }
			`}</style>

			<div className="group relative z-20">
				<ControlBar
					title="Mini Player"
					icon={<MiniPlayerIcon className="antialiased" />}
					divider={
						<button
							type="button"
							className="control-button relative h-4 w-4 hover:bg-white/5 group-hover:w-auto group-hover:space-x-2 group-hover:px-2"
							onClick={() => toggleStayTop()}
						>
							{isTop ? <LockIcon className="group-hover:opacity-100" /> : <UnLockIcon className="opacity-60" />}
							<span className="hidden text-sm group-hover:flex">Stay on Top</span>
						</button>
					}
				/>
				<div className="absolute inset-x-0 -top-32 z-10 h-48 bg-gradient-to-b from-black to-black/0" />
			</div>

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

			<div className="relative z-10 flex flex-1 flex-col">
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
									<button
										type="button"
										className={cn("player-btn", !!playState?.disliked && "active")}
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
									</button>
								)}
								{playState?.liked !== undefined && (
									<button
										type="button"
										className={cn("player-btn", !!playState?.liked && "active")}
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
									</button>
								)}
								{lastFM.connected && (
									<button
										type="button"
										className={cn("player-btn relative size-8 p-1", lastFMLoading && "btn-disabled opacity-70")}
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
									</button>
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
							<button type="button" className="player-btn" disabled={trackBusy} aria-label="Previous" onClick={prev}>
								<PrevIcon />
							</button>
							<button
								type="button"
								className="player-btn"
								disabled={trackBusy}
								aria-label="Rewind 10 seconds"
								onClick={() => backward()}
							>
								<BackwardIcon />
							</button>
						</div>
						<button
							type="button"
							className="player-btn-hero"
							style={accentColor ? { borderColor: accentColor } : undefined}
							aria-label="Pause"
							disabled={trackBusy}
							onClick={() => (!playing ? play() : pause())}
						>
							<div className="fill-icon fill-zinc-700">{playing ? <PauseIcon /> : <PlayIcon />}</div>
						</button>
						<div className="flex flex-auto items-center justify-evenly">
							<button
								type="button"
								className="player-btn"
								disabled={trackBusy}
								aria-label="Skip 10 seconds"
								onClick={() => forward()}
							>
								<ForwardIcon />
							</button>
							<button type="button" className="player-btn" disabled={trackBusy} aria-label="Next" onClick={next}>
								<NextIcon />
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
