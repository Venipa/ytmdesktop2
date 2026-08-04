import type { UpdateInfo } from "@shared/utils/updater";
import { AlertCircleIcon, CheckIcon, DownloadIcon } from "lucide-react";
import { useState } from "react";
import DevIcon from "@/assets/icons/chip.svg?react";
import RPCIcon from "@/assets/icons/discord-rpc.svg?react";
import HomeIcon from "@/assets/icons/home.svg?react";
import LastFMIcon from "@/assets/icons/lastfm.svg?react";
import MiniPlayerIcon from "@/assets/icons/mini-player.svg?react";
import RefreshIcon from "@/assets/icons/refresh.svg?react";
import { Spinner } from "@/components/ui/spinner";
import { useLastFm } from "@/hooks/use-lastfm";
import { useSetting } from "@/hooks/use-settings";
import { trpc } from "@/lib/trpc";

export function ToolbarOptions() {
	const utils = trpc.useUtils();
	const [discordConnected, setDiscordConnected] = useState(false);
	const [discordLoading, setDiscordLoading] = useState(false);
	const [discordConnectionError, setDiscordConnectionError] = useState<string | null>(null);
	const [miniPlayer, setMiniPlayer] = useState<{ active?: boolean } | null>(null);
	const [playState, setPlayState] = useState<unknown>(null);
	const [isHome, setIsHome] = useState(true);
	const [updateChecking, setUpdateChecking] = useState(false);
	const { data: updateInfo = null } = trpc.update.get.useQuery();
	const { data: updateDownloaded = false } = trpc.update.downloaded.useQuery();
	const { lastFM, lastFMState, lastFMLoading, authorizeLastFM } = useLastFm();
	const [discordEnabled, setDiscordEnabled] = useSetting<boolean>("discord.enabled", false);
	const [isDev] = useSetting<boolean>("app.enableDev", false);

	const checkUpdate = trpc.update.check.useMutation({
		onSettled: () => setUpdateChecking(false),
	});
	const homeNav = trpc.navigation.home.useMutation();
	const devTools = trpc.navigation.devTools.useMutation();
	const openMiniplayer = trpc.miniplayer.open.useMutation();

	trpc.discord.connected.useQuery(undefined, {
		onSuccess: (connected) => setDiscordConnected(!!connected),
	});
	trpc.discord.onConnected.useSubscription(undefined, {
		onData: () => {
			setDiscordConnected(true);
			setDiscordConnectionError(null);
			setDiscordLoading(false);
		},
	});
	trpc.discord.onDisconnected.useSubscription(undefined, {
		onData: () => setDiscordConnected(false),
	});
	trpc.discord.onLoading.useSubscription(undefined, {
		onData: () => setDiscordLoading(true),
	});
	trpc.discord.onError.useSubscription(undefined, {
		onData: (err) => setDiscordConnectionError(err),
	});
	trpc.miniplayer.onState.useSubscription(undefined, {
		onData: setMiniPlayer,
	});
	trpc.track.state.useQuery(undefined, {
		onSuccess: setPlayState,
	});
	trpc.track.onPlayState.useSubscription(undefined, {
		onData: setPlayState,
	});
	trpc.navigation.onSameOrigin.useSubscription(undefined, {
		onData: (sameOrigin) => setIsHome(!!sameOrigin),
	});
	trpc.update.onUpdate.useSubscription(undefined, {
		onData: (info) => utils.update.get.setData(undefined, info as UpdateInfo | null),
	});
	trpc.update.onChecking.useSubscription(undefined, {
		onData: (checking) => setUpdateChecking(!!checking),
	});
	trpc.update.onDownloaded.useSubscription(undefined, {
		onData: () => utils.update.downloaded.setData(undefined, true),
	});

	function handleCheckUpdate() {
		if (updateChecking || checkUpdate.isPending) return;
		setUpdateChecking(true);
		checkUpdate.mutate();
	}

	function toggleDiscord() {
		setDiscordConnectionError(null);
		setDiscordEnabled(!discordEnabled);
	}

	return (
		<div className="flex flex-row items-center gap-2">
			<button
				type="button"
				className={`control-button relative h-4 ${lastFMLoading ? "opacity-70" : ""} ${lastFM?.name ? "!w-auto flex gap-2.5 items-center px-1.5" : "w-4"}`}
				onClick={authorizeLastFM}
			>
				{lastFM?.connected && !lastFM?.error && lastFMState !== null ? (
					typeof lastFMState === "string" ? (
						<Spinner className="size-3" />
					) : lastFMState === true ? (
						<CheckIcon className="text-green-500" />
					) : (
						<AlertCircleIcon className="text-red-500" />
					)
				) : (
					<LastFMIcon className={lastFM?.connected && !lastFM?.error ? "text-green-500" : lastFM?.error ? "text-red-500" : undefined} />
				)}
				{lastFM?.name && <span className="text-sm text-gray-100">{lastFM.name}</span>}
			</button>
			{!isHome && (
				<button type="button" className="control-button relative size-4" onClick={() => homeNav.mutate()}>
					<HomeIcon />
				</button>
			)}
			<button type="button" className="control-button relative size-4" disabled={!!updateChecking} onClick={handleCheckUpdate}>
				{updateChecking && !updateInfo ? (
					<Spinner className="size-3" />
				) : updateInfo ? (
					<DownloadIcon className={!updateDownloaded ? "animate-pulse" : "text-green-500"} />
				) : (
					<RefreshIcon />
				)}
			</button>
			{isDev && (
				<button type="button" className="control-button relative size-4" onClick={() => devTools.mutate()}>
					<DevIcon />
				</button>
			)}
			<button
				type="button"
				className={`control-button relative size-4 ${miniPlayer ? (miniPlayer.active ? "opacity-100" : "opacity-70") : ""}`}
				disabled={!playState}
				onClick={() => openMiniplayer.mutate()}
			>
				<MiniPlayerIcon />
			</button>
			<button type="button" className="control-button relative" onClick={toggleDiscord}>
				<RPCIcon
					className={
						discordConnectionError && discordEnabled
							? "text-red-500"
							: discordEnabled || discordConnectionError
								? "opacity-100"
								: "opacity-70"
					}
				/>
				{discordConnected && !discordConnectionError && !discordLoading && (
					<div className="absolute top-0 right-0 flex size-3 items-center justify-center rounded-full bg-green-500 p-0.5">
						<svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
							<polyline points="20 6 9 17 4 12" />
						</svg>
					</div>
				)}
				{discordLoading && (
					<div className="absolute top-0 right-0 flex size-3 items-center justify-center rounded-full bg-gray-600 p-0.5">
						<Spinner className="size-2" />
					</div>
				)}
			</button>
			<button type="button" className="control-button" onClick={() => window.api.openWindow("settingsWindow")}>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
					<path
						fillRule="evenodd"
						d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
						clipRule="evenodd"
					/>
				</svg>
			</button>
		</div>
	);
}
