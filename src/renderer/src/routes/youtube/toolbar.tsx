import type { TrackData } from "@shared/track/trackData";
import type { ProgressInfo, UpdateInfo } from "@shared/utils/updater";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftIcon, MaximizeIcon, Minimize2, XIcon } from "lucide-react";
import { useState } from "react";
import { ToolbarOptions } from "@/components/toolbar-options";
import { Spinner } from "@/components/ui/spinner";
import { useMainWindowState } from "@/hooks/use-settings";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/youtube/toolbar")({
	component: YoutubeToolbarPage,
});

function YoutubeToolbarPage() {
	const appVersion = window.api.version;
	const isDarwin = window.process.platform === "darwin";
	const [state] = useMainWindowState();
	const utils = trpc.useUtils();
	const { data: updateInfo = null } = trpc.update.get.useQuery();
	const { data: updateDownloaded = false } = trpc.update.downloaded.useQuery();
	const [title, setTitle] = useState<string | null>(null);
	const [updateInfoProgress, setUpdateInfoProgress] = useState<ProgressInfo | null>(null);
	const [isInstalling, setIsInstalling] = useState(false);

	const goBack = trpc.navigation.goback.useMutation();
	const minimize = trpc.app.minimize.useMutation();
	const maximize = trpc.app.maximize.useMutation();
	const checkUpdate = trpc.update.check.useMutation({
		onSettled: () => setIsInstalling(false),
	});

	trpc.track.onTrack.useSubscription(undefined, {
		onData: (track) => setTitle((track as TrackData | null)?.video?.title ?? null),
	});
	trpc.update.onUpdate.useSubscription(undefined, {
		onData: (info) => utils.update.get.setData(undefined, info as UpdateInfo | null),
	});
	trpc.update.onProgress.useSubscription(undefined, {
		onData: (progress) => setUpdateInfoProgress(progress as ProgressInfo),
	});
	trpc.update.onDownloaded.useSubscription(undefined, {
		onData: () => utils.update.downloaded.setData(undefined, true),
	});

	function runUpdate() {
		if (isInstalling || checkUpdate.isPending) return;
		setIsInstalling(true);
		checkUpdate.mutate();
	}

	return (
		<div className="h-full overflow-hidden">
			<div className={`flex h-10 items-stretch justify-between gap-2 border-b border-gray-600 bg-black px-2 select-none ${isDarwin ? "pl-20" : ""}`}>
				<button
					type="button"
					className={`control-button self-center cursor-pointer ${!state?.navigation?.canGoBack ? "disabled" : ""}`}
					disabled={!state?.navigation?.canGoBack}
					onClick={() => goBack.mutate()}
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
						<div className="flex h-7 items-center truncate rounded bg-primary/50 px-3 text-xs">
							<span className="truncate overflow-ellipsis">{title}</span>
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
								updateInfo && !updateInfoProgress && !updateDownloaded ? "bg-green-500 text-white" : updateDownloaded ? "text-green-500" : ""
							}`}
							onClick={runUpdate}
						>
							{updateInfoProgress?.percent ? (
								<>
									<Spinner className="size-3" />
									<span>
										Downloading Update v{updateInfo.version}... {updateInfoProgress.percent.toFixed(0).padStart(5)}%
									</span>
								</>
							) : (
								<span className="truncate overflow-ellipsis">New Update v{updateInfo.version}</span>
							)}
						</button>
					)}
					<ToolbarOptions />
					{!isDarwin && (
						<>
							<div className="h-6 w-px bg-gray-600" />
							<div className="flex items-center gap-1">
								<button type="button" className="control-button" onClick={() => minimize.mutate()}>
									<Minimize2 />
								</button>
								<button type="button" className="control-button" onClick={() => maximize.mutate()}>
									<MaximizeIcon />
								</button>
								<button type="button" className="control-button control-button-danger" onClick={() => window.api.quit()}>
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
