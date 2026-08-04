import type { ProgressInfo, UpdateInfo } from "@shared/utils/updater";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/_settings/about")({
	component: AboutSettingsPage,
});

function AboutSettingsPage() {
	const appVersion = window.api.version;
	const utils = trpc.useUtils();
	const { data: updateInfo = null } = trpc.update.get.useQuery();
	const { data: updateDownloaded = false } = trpc.update.downloaded.useQuery();
	const [updateInfoProgress, setUpdateInfoProgress] = useState<ProgressInfo | null>(null);
	const [updateChecking, setUpdateChecking] = useState(false);
	const checkUpdate = trpc.update.check.useMutation({
		onSettled: () => setUpdateChecking(false),
	});
	const installUpdate = trpc.update.install.useMutation({
		onSuccess: () => utils.update.get.setData(undefined, null),
	});

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

	function handleCheckUpdate() {
		if (updateChecking || checkUpdate.isPending) return;
		setUpdateChecking(true);
		checkUpdate.mutate();
	}

	function runUpdate() {
		if (installUpdate.isPending) return;
		installUpdate.mutate(true);
	}

	return (
		<div className="container mx-auto my-8">
			<div className="flex flex-col">
				<div className="mx-4 gap-1 sm:mx-6">
					<h3 className="text-lg font-medium leading-6 text-foreground">About</h3>
					<p className="text-sm text-muted-foreground">Shows information about your YouTube Desktop Instance</p>
				</div>
				<Separator className="my-4" />
				<div className="mx-4 flex flex-row sm:mx-6">
					<div className="flex flex-1 flex-col">
						<span className="font-semibold">Version</span>
						<span className="text-sm text-green-500">{appVersion}</span>
					</div>
					{updateInfo && updateDownloaded ? (
						<Button variant="ghost" onClick={runUpdate} disabled={installUpdate.isPending}>
							<div className="flex flex-col items-center justify-center gap-1 leading-none">
								<div>Install Update</div>
								<div className="text-green-500">{updateInfo.version}</div>
							</div>
						</Button>
					) : updateInfo && updateInfoProgress?.percent ? (
						<Button variant="ghost" disabled className="gap-4">
							<span>Downloading...{updateInfoProgress.percent.toFixed(0).padStart(5)}%</span>
							<Spinner />
						</Button>
					) : (
						<Button variant="ghost" className="gap-4" onClick={handleCheckUpdate}>
							<span>{updateChecking ? "Checking for Updates..." : "Check for Update"}</span>
							{updateChecking && <Spinner />}
						</Button>
					)}
				</div>
				<Separator className="my-4" />
				<div className="flex flex-col gap-4 px-5">
					<SettingsCheckbox configKey="app.beta">Include Pre Releases / Beta</SettingsCheckbox>
				</div>
			</div>
		</div>
	);
}
