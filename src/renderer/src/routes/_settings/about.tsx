import type { ProgressInfo, UpdateInfo } from "@shared/utils/updater";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
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
	const { mutateAsync: check, isPending: checkPending } = trpc.update.check.useMutation({
		onSettled: () => setUpdateChecking(false),
	});
	const { mutateAsync: install, isPending: installPending } = trpc.update.install.useMutation({
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
		if (updateChecking || checkPending) return;
		setUpdateChecking(true);
		void check();
	}

	function runUpdate() {
		if (installPending) return;
		void install(true);
	}

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>About</CardTitle>
					<CardDescription>Information about your YouTube Music Desktop instance.</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-between gap-4">
						<div className="flex flex-col gap-1">
							<span className="text-xs font-medium">Version</span>
							<span className="text-xs text-muted-foreground">{appVersion}</span>
						</div>
						{updateInfo && updateDownloaded ? (
							<Button variant="outline" onClick={runUpdate} disabled={installPending}>
								Install {updateInfo.version}
							</Button>
						) : updateInfo && updateInfoProgress?.percent ? (
							<Button variant="outline" disabled>
								Downloading… {updateInfoProgress.percent.toFixed(0)}%
								<span data-icon="inline-end">
									<Spinner />
								</span>
							</Button>
						) : (
							<Button variant="outline" onClick={handleCheckUpdate} disabled={updateChecking || checkPending}>
								{updateChecking ? "Checking…" : "Check for Update"}
								{updateChecking ? (
									<span data-icon="inline-end">
										<Spinner />
									</span>
								) : null}
							</Button>
						)}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Channels</CardTitle>
					<CardDescription>Choose which release channel to follow.</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<SettingsCheckbox configKey="app.beta" description="Include pre-release builds when checking for updates.">
							Include Pre Releases / Beta
						</SettingsCheckbox>
					</FieldGroup>
				</CardContent>
			</Card>
		</>
	);
}
