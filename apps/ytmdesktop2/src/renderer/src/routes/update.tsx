import type { ProgressInfo } from "@shared/utils/updater";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownCircleIcon, ArrowRightIcon, CheckCircle2Icon, DownloadIcon, RefreshCwIcon } from "lucide-react";
import _prettyBytes from "pretty-bytes";
import { ReleaseTimeline } from "@/components/release-notes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { useUpdater } from "@/hooks/use-updater";

export const Route = createFileRoute("/update")({
	component: UpdatePage,
});

const prettyBytes = (bytes: number) => _prettyBytes(bytes, { binary: true, space: true });

function UpdateActions(props: {
	isMacOS: boolean;
	isDownloading: boolean;
	downloaded: boolean;
	installing: boolean;
	progress: ProgressInfo | null;
	onInstall: (quitAndInstall: boolean) => void;
	onLater: () => void;
}) {
	const { isMacOS, isDownloading, downloaded, installing, progress, onInstall, onLater } = props;
	const showDownloadProgress = !!progress && !downloaded && !installing;

	return (
		<div className="flex flex-col gap-3">
			{showDownloadProgress ? (
				<div className="flex flex-col gap-2">
					<Progress value={Math.round(progress.percent)}>
						<ProgressLabel>{progress.percent >= 100 ? "Download complete" : "Downloading"}</ProgressLabel>
						<ProgressValue />
					</Progress>
					<div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
						<span>{prettyBytes(progress.total)}</span>
						<span>
							{progress.percent >= 100
								? prettyBytes(progress.total)
								: `${prettyBytes(progress.transferred)} / ${prettyBytes(progress.total)}`}
						</span>
					</div>
				</div>
			) : null}

			{isDownloading ? (
				<Button variant="secondary" className="w-full" size={"xl"} disabled>
					<Spinner size={"sm"} />
					Downloading...
				</Button>
			) : downloaded && !installing ? (
				<div className="flex w-full flex-col gap-2">
					<Button variant="accent" className="w-full" size={"xl"} onClick={() => onInstall(true)}>
						<CheckCircle2Icon />
						Install now
					</Button>
					{!isMacOS ? (
						<Button variant="outline" className="w-full" onClick={onLater}>
							Later
						</Button>
					) : null}
				</div>
			) : installing ? (
				<div className="flex w-full flex-col items-center gap-2 py-1">
					<Spinner />
					<span className="text-xs text-muted-foreground">Installing... app will restart</span>
				</div>
			) : (
				<div className="flex w-full flex-col gap-2">
					<Button variant="accent" className="w-full" size={"xl"} onClick={() => onInstall(isMacOS)}>
						<ArrowDownCircleIcon />
						{isMacOS ? "Download & install" : "Download"}
					</Button>
					<Button variant="outline" className="w-full" onClick={onLater}>
						Later
					</Button>
				</div>
			)}
		</div>
	);
}

function UpdatePage() {
	const currentVersion = window.api.version;
	const isMacOS = window.api.platform.isMacOS;
	const { updateInfo, downloaded, progress, checking, installing, status, check, install, dismiss } = useUpdater();
	const isDownloading = status === "downloading" || (!!progress && !downloaded);

	async function installUpdate(quitAndInstall = true) {
		if (installing) return;
		try {
			await install(quitAndInstall);
		} catch (err) {
			if (err instanceof Error && err.message.endsWith("[E002]")) return;
			throw err;
		}
	}

	if (checking && !updateInfo) {
		return (
			<div className="drag flex h-full min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
				<div className="flex size-12 items-center justify-center rounded-full bg-muted">
					<Spinner className="size-5" />
				</div>
				<div className="flex flex-col gap-1.5">
					<h2 className="text-sm font-medium">Checking for updates</h2>
					<p className="text-xs text-muted-foreground">Looking for a newer build…</p>
				</div>
				<Badge variant="outline">v{currentVersion}</Badge>
			</div>
		);
	}

	if (updateInfo) {
		const releases = updateInfo.releases?.length
			? updateInfo.releases
			: updateInfo.releaseNotes
				? [{ version: updateInfo.version, name: updateInfo.releaseName, body: updateInfo.releaseNotes, publishedAt: updateInfo.releaseDate }]
				: [];

		return (
			<div className="flex h-full min-h-screen bg-background">
				{/* left — summary + actions */}
				<aside className="drag flex w-[240px] shrink-0 flex-col border-r border-border p-5">
					<div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
						<div className="flex size-10 items-center justify-center rounded-full bg-muted">
							<DownloadIcon className="text-primary" />
						</div>
						<div className="flex flex-col gap-1">
							<h2 className="text-sm font-medium">Update available</h2>
							<p className="text-xs text-muted-foreground text-balance">
								{updateInfo.releaseName ?? `Version ${updateInfo.version} is ready`}
							</p>
						</div>
						<div className="flex items-center justify-center gap-2">
							<Badge variant="outline">v{currentVersion}</Badge>
							<ArrowRightIcon className="size-3 text-muted-foreground" />
							<Badge>v{updateInfo.version}</Badge>
						</div>
					</div>

					<div className="no-drag mt-auto pt-4">
						<UpdateActions
							isMacOS={isMacOS}
							isDownloading={isDownloading}
							downloaded={downloaded}
							installing={installing}
							progress={progress}
							onInstall={(quit) => void installUpdate(quit)}
							onLater={() => void dismiss()}
						/>
					</div>
				</aside>

				{/* right — changelog timeline */}
				<main className="flex min-w-0 flex-1 flex-col">
					<ScrollArea className="min-h-0 flex-1">
						<div className="px-5 py-4">
							<ReleaseTimeline releases={releases} />
						</div>
					</ScrollArea>
				</main>
			</div>
		);
	}

	return (
		<div className="drag flex h-full min-h-screen flex-col items-center justify-center gap-5 bg-background p-8 text-center">
			<div className="flex size-12 items-center justify-center rounded-full bg-muted">
				<CheckCircle2Icon className="text-primary" />
			</div>
			<div className="flex flex-col gap-1.5">
				<h2 className="text-sm font-medium">You&apos;re up to date</h2>
				<p className="text-xs text-muted-foreground">Running the latest version</p>
			</div>
			<Badge variant="outline">v{currentVersion}</Badge>
			<div className="no-drag flex items-center justify-center gap-2 pt-1">
				<Button size="sm" variant="outline" onClick={() => void check(false)} disabled={checking}>
					<span data-icon="inline-start">
						{checking ? <Spinner /> : <RefreshCwIcon />}
					</span>
					Check again
				</Button>
				<Button size="sm" variant="ghost" onClick={() => window.close()}>
					Close
				</Button>
			</div>
		</div>
	);
}
