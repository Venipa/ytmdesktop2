import { AlertCircleIcon, CheckIcon, DownloadIcon } from "lucide-react";
import DevIcon from "@/assets/icons/chip.svg?react";
import RPCIcon from "@/assets/icons/discord-rpc.svg?react";
import HomeIcon from "@/assets/icons/home.svg?react";
import LastFMIcon from "@/assets/icons/lastfm.svg?react";
import MiniPlayerIcon from "@/assets/icons/mini-player.svg?react";
import RefreshIcon from "@/assets/icons/refresh.svg?react";
import { Spinner } from "@/components/ui/spinner";
import { useDiscord } from "@/hooks/use-discord";
import { useLastFm } from "@/hooks/use-lastfm";
import { useMiniPlayer } from "@/hooks/use-miniplayer";
import { useNavigation } from "@/hooks/use-navigation";
import { useSettingsState } from "@/hooks/use-settings";
import { useTrackState } from "@/hooks/use-track";
import { useUpdater } from "@/hooks/use-updater";
import { trpc } from "@/lib/trpc";

export function ToolbarOptions() {
	const { lastFM, lastFMState, lastFMLoading, authorizeLastFM } = useLastFm();
	const { connected: discordConnected, loading: discordLoading, error: discordConnectionError, enabled: discordEnabled, toggle: toggleDiscord } = useDiscord();
	const { isHome, home, devTools } = useNavigation();
	const { state: miniPlayer, open: openMiniPlayer } = useMiniPlayer();
	const playState = useTrackState();
	const { updateInfo, downloaded: updateDownloaded, checking: updateChecking, status, check } = useUpdater();
	const [isDev] = useSettingsState<boolean>("app.enableDev", false);
	const { mutateAsync: openWindow } = trpc.app.openWindow.useMutation();

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
				<button type="button" className="control-button relative size-4" onClick={() => void home()}>
					<HomeIcon />
				</button>
			)}
			<button type="button" className="control-button relative size-4" disabled={!!updateChecking} onClick={() => void check()}>
				{status === "checking" && !updateInfo ? (
					<Spinner className="size-3" />
				) : updateInfo ? (
					<DownloadIcon className={status === "ready" || updateDownloaded ? "text-green-500" : "animate-pulse"} />
				) : (
					<RefreshIcon />
				)}
			</button>
			{isDev && (
				<button type="button" className="control-button relative size-4" onClick={() => void devTools()}>
					<DevIcon />
				</button>
			)}
			<button
				type="button"
				className={`control-button relative size-4 ${miniPlayer ? (miniPlayer.active ? "opacity-100" : "opacity-70") : ""}`}
				disabled={!playState}
				onClick={() => void openMiniPlayer()}
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
			<button type="button" className="control-button" onClick={() => void openWindow("settingsWindow")}>
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
