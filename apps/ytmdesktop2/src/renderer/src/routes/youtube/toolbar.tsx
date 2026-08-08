import { cn } from "@renderer/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftIcon, MaximizeIcon, Minimize2, XIcon } from "lucide-react";
import { useMemo } from "react";
import { ToolbarOptions } from "@/components/toolbar-options";
import { Spinner } from "@/components/ui/spinner";
import { useNavigation } from "@/hooks/use-navigation";
import { useMainWindowState } from "@/hooks/use-settings";
import { useTrack } from "@/hooks/use-track";
import { useUpdater } from "@/hooks/use-updater";
import { useWindowControls } from "@/hooks/use-window-controls";

export const Route = createFileRoute("/youtube/toolbar")({
	component: YoutubeToolbarPage,
});

function YoutubeToolbarPage() {
	const appVersion = useMemo(() => window.api.version, []);
	const isDarwin = useMemo(() => window.app.platform === "darwin", []);
	const [state] = useMainWindowState();
	const track = useTrack();
	const { updateInfo, downloaded, progress, isPending: updatePending, status, runUpdate } = useUpdater();
	const { minimize, maximize, quit } = useWindowControls();
	const { goback } = useNavigation();

	const title = useMemo(() => track?.video?.title ?? null, [track]);
	const canGoBack = useMemo(() => {
		const nav = state?.navigation;
		return typeof nav === "object" && nav ? nav.canGoBack : false;
	}, [state?.navigation]);

	return (
		<div className="h-full overflow-hidden">
			<div className={`flex h-10 items-stretch justify-between gap-2 border-b border-neutral-800 bg-black px-2 select-none ${isDarwin ? "pl-20" : ""}`}>
				<button
					type="button"
					className={cn("control-button self-center cursor-pointer", !canGoBack && "disabled")}
					disabled={!canGoBack}
					onClick={() => void goback()}
				>
					<ArrowLeftIcon />
				</button>
				<div className="drag flex flex-1 items-center gap-2">
					{!isDarwin && (
						<div className="flex items-center gap-1">
							<div className="-mt-px flex-none text-xs">YouTube Music for Desktop</div>
							{appVersion !== undefined && <div className="text-xs text-white opacity-30">v{appVersion}</div>}
						</div>
					)}
					{title && (
						<div className="flex h-7 items-center truncate rounded bg-blue-500/50 px-3 text-xs">
							<span className="truncate text-ellipsis">{title}</span>
						</div>
					)}
				</div>
				<div className="flex items-center gap-2">
					{isDarwin && appVersion && (
						<>
							<div className="text-xs text-white opacity-30">v{appVersion}</div>
							<div className="h-6 w-px bg-gray-600" />
						</>
					)}
					{updateInfo && (
						<button
							type="button"
							className={`flex h-7 cursor-pointer items-center gap-2 truncate rounded px-3 text-xs transition duration-100 ease-out ${
								status === "available" ? "bg-green-500 text-white" : status === "ready" || downloaded ? "text-green-500" : ""
							}`}
							disabled={updatePending}
							onClick={() => void runUpdate()}
						>
							{status === "downloading" && progress?.percent ? (
								<>
									<Spinner size="sm" />
									<span>
										Downloading Update v{updateInfo.version}... {progress.percent.toFixed(0).padStart(5)}%
									</span>
								</>
							) : status === "installing" ? (
								<>
									<Spinner size="sm" />
									<span>Installing Update v{updateInfo.version}…</span>
								</>
							) : (
								<span className="truncate text-ellipsis">New Update v{updateInfo.version}</span>
							)}
						</button>
					)}
					<ToolbarOptions />
					{!isDarwin && (
						<>
							<div className="h-6 w-px bg-gray-600" />
							<div className="flex items-center gap-1">
								<button type="button" className="control-button" onClick={() => void minimize()}>
									<Minimize2 />
								</button>
								<button type="button" className="control-button" onClick={() => void maximize()}>
									<MaximizeIcon />
								</button>
								<button type="button" className="control-button control-button-danger" onClick={() => void quit()}>
									<XIcon />
								</button>
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
