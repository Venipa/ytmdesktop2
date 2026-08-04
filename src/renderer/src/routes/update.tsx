import type { ProgressInfo, UpdateInfo } from "@shared/utils/updater";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircleIcon, DownloadIcon } from "lucide-react";
import _prettyBytes from "pretty-bytes";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/update")({
	component: UpdatePage,
});

const prettyBytes = (bytes: number) => _prettyBytes(bytes, { binary: true, space: true });

function UpdatePage() {
	const [isComplete, setIsComplete] = useState(false);
	const currentVersion = "v" + window.api.version;
	const utils = trpc.useUtils();
	const { data: updateInfo = null } = trpc.update.get.useQuery();
	const { data: updateDownloaded = false } = trpc.update.downloaded.useQuery();
	const [updateInfoProgress, setUpdateInfoProgress] = useState<ProgressInfo | null>(null);
	const [updateChecking, setUpdateChecking] = useState(false);
	const [isInstalling, setIsInstalling] = useState(false);
	const isMacOS = window.api.platform.isMacOS;

	const checkUpdate = trpc.update.check.useMutation({
		onSettled: () => setUpdateChecking(false),
	});
	const installUpdateMutation = trpc.update.install.useMutation();

	trpc.update.onUpdate.useSubscription(undefined, {
		onData: (info) => utils.update.get.setData(undefined, info as UpdateInfo | null),
	});
	trpc.update.onChecking.useSubscription(undefined, {
		onData: (checking) => setUpdateChecking(!!checking),
	});
	trpc.update.onProgress.useSubscription(undefined, {
		onData: (progress) => setUpdateInfoProgress(progress as ProgressInfo),
	});
	trpc.update.onDownloaded.useSubscription(undefined, {
		onData: () => utils.update.downloaded.setData(undefined, true),
	});

	function installUpdate(quitAndInstall = true) {
		if (isInstalling) return Promise.resolve(null);
		setIsInstalling(true);
		if (!updateDownloaded) {
			setUpdateInfoProgress({ total: 0, delta: 0, transferred: 0, percent: 0, bytesPerSecond: 0 });
		}
		return installUpdateMutation
			.mutateAsync(quitAndInstall)
			.then((downloaded) => {
				if (!updateDownloaded) {
					setIsComplete(!!downloaded);
					utils.update.downloaded.setData(undefined, !!downloaded);
				} else {
					setTimeout(() => {
						setIsInstalling(false);
						installUpdate(true);
					}, 20000);
				}
				setUpdateInfoProgress(null);
			})
			.catch((err) => {
				setUpdateInfoProgress(null);
				if (err instanceof Error && err.message.endsWith("[E002]")) {
					setIsInstalling(true);
				} else throw err;
			})
			.finally(() => setIsInstalling(false));
	}

	function handleCheckUpdate() {
		if (updateChecking || checkUpdate.isPending) return;
		setUpdateChecking(true);
		checkUpdate.mutate();
	}

	if (updateChecking) {
		return (
			<div className="flex h-full min-h-screen flex-col overflow-x-hidden overflow-y-auto bg-black p-4">
				<div className="flex flex-grow flex-col items-center justify-center px-6 py-12 text-center">
					<h2 className="mb-2 text-xl font-semibold text-white">Checking for Updates</h2>
					<p className="mb-6 text-sm text-gray-400">Please wait while we check for available updates...</p>
					<Spinner className="size-8" />
				</div>
			</div>
		);
	}

	if (updateInfo) {
		return (
			<div className="flex h-full min-h-screen flex-col overflow-x-hidden overflow-y-auto bg-black p-4">
				<div className="drag px-6 pt-6 pb-4 text-center">
					<div className="mx-auto mb-4 w-fit rounded-full bg-gray-900 p-3">
						<DownloadIcon size={32} className="text-blue-400" />
					</div>
					<h2 className="mb-2 text-xl font-semibold text-white">Update Available</h2>
					<p className="text-sm text-gray-400">Version {updateInfo.version} is ready to install</p>
				</div>
				<div className="flex flex-col gap-6 px-6 pb-6">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium text-white">Current Version</p>
							<p className="text-xs text-gray-400">{currentVersion}</p>
						</div>
						<div className="text-right">
							<p className="text-sm font-medium text-white">New Version</p>
							<p className="text-xs text-gray-400">{updateInfo.version}</p>
						</div>
					</div>
					<div className="border-t border-gray-800" />
					{updateInfo.releaseNotes && (
						<div className="flex flex-col gap-3">
							<h4 className="text-sm font-medium text-white">Release Notes</h4>
							<div className="text-sm text-gray-200" dangerouslySetInnerHTML={{ __html: String(updateInfo.releaseNotes) }} />
						</div>
					)}
					{updateInfoProgress && (
						<div className="flex flex-col gap-3">
							<div className="border-t border-gray-800" />
							<div className="flex flex-col gap-2">
								<div className="flex items-center justify-between text-xs">
									<span className="text-gray-400">{isComplete ? "Download Complete" : "Downloading..."}</span>
									<span className="text-white">{Math.round(updateInfoProgress.percent)}%</span>
								</div>
								<div className="h-2 w-full rounded-full bg-gray-800">
									<div className="h-2 rounded-full bg-blue-600 transition-all duration-300 ease-out" style={{ width: `${updateInfoProgress.percent}%` }} />
								</div>
								<div className="flex items-center justify-between text-xs text-gray-300">
									<span>Size: {prettyBytes(updateInfoProgress.total)}</span>
									<span>
										{isComplete
											? prettyBytes(updateInfoProgress.total)
											: `${prettyBytes(updateInfoProgress.transferred)} / ${prettyBytes(updateInfoProgress.total)}`}
									</span>
								</div>
							</div>
						</div>
					)}
					<div className="flex gap-3 pt-2">
						{updateInfoProgress && !updateDownloaded ? (
							<Button className="w-full" disabled>
								Downloading...
							</Button>
						) : updateDownloaded && !isInstalling && !isMacOS ? (
							<>
								<Button variant="outline" className="flex-1" onClick={() => window.close()}>
									Later
								</Button>
								<Button className="w-full gap-2 bg-green-600 hover:bg-green-700" onClick={() => installUpdate(true)}>
									<CheckCircleIcon size={16} /> Install Now
								</Button>
							</>
						) : isInstalling && updateDownloaded ? (
							<div className="flex h-20 items-center justify-center gap-2">
								<Spinner />
								<span className="text-xs text-gray-400">Installing...</span>
							</div>
						) : !updateDownloaded ? (
							<>
								<Button variant="outline" className="flex-1" onClick={() => window.close()}>
									Later
								</Button>
								<Button className="flex-1 gap-2" onClick={() => installUpdate(isMacOS)}>
									<DownloadIcon size={16} /> {isMacOS ? "Download and Install" : "Download"}
								</Button>
							</>
						) : null}
					</div>
					{!isMacOS && (
						<div className="pt-2 text-center">
							<p className="text-xs text-gray-400">Update will be installed automatically after download</p>
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-screen flex-col overflow-x-hidden overflow-y-auto bg-black p-4">
			<div className="flex flex-grow flex-col items-center justify-center px-6 py-12 text-center">
				<div className="mx-auto mb-4 w-fit rounded-full bg-gray-900 p-3">
					<CheckCircleIcon size={32} className="text-green-400" />
				</div>
				<h2 className="mb-2 text-xl font-semibold text-white">You're Up to Date</h2>
				<p className="mb-6 text-sm text-gray-400">Your software is running the latest version ({currentVersion})</p>
				<div className="flex flex-col items-center gap-2">
					<Button size="sm" onClick={handleCheckUpdate}>
						Check Again
					</Button>
					<Button size="sm" variant="ghost" onClick={() => window.close()}>
						Close
					</Button>
				</div>
			</div>
		</div>
	);
}
