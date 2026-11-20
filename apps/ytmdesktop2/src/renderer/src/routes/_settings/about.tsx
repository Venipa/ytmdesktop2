import { RiFolderOpenLine } from "@remixicon/react";
import { UPDATE_CHANNEL_LABELS, type UpdateChannel } from "@shared/utils/updater";
import { createFileRoute } from "@tanstack/react-router";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { SettingsSelect } from "@/components/settings-select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useUpdater } from "@/hooks/use-updater";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/_settings/about")({
	component: AboutSettingsPage,
});

const CHANNEL_DESCRIPTIONS: Record<UpdateChannel, string> = {
	stable: "Official releases only. Recommended for most users.",
	beta: "Release candidates (-rc.n). Also receives newer stable builds.",
	alpha: "Early builds (-a.n). Also receives newer beta and stable builds.",
};

const CHANNEL_OPTIONS = (Object.keys(UPDATE_CHANNEL_LABELS) as UpdateChannel[]).map((value) => ({
	value,
	label: UPDATE_CHANNEL_LABELS[value],
	description: CHANNEL_DESCRIPTIONS[value],
}));

function AboutSettingsPage() {
	const appVersion = window.api.version;
	const { updateInfo, progress, status, checking, installing, check, install } = useUpdater();
	const { mutateAsync: openLogsFolder, isLoading: openingLogs } = trpc.app.openLogsFolder.useMutation();

	return (
		<>
			<SettingsGroup title="About">
				<SettingsRow label="Version" description={appVersion}>
						{status === "ready" && updateInfo ? (
							<Button variant="outline" onClick={() => void install(true)} disabled={installing}>
								Install {updateInfo.version}
								{installing ? (
									<span data-icon="inline-end">
										<Spinner />
									</span>
								) : null}
							</Button>
						) : status === "downloading" || status === "installing" ? (
							<Button variant="outline" disabled>
								{status === "installing" ? "Installing..." : `Downloading... ${(progress?.percent ?? 0).toFixed(0)}%`}
								<span data-icon="inline-end">
									<Spinner />
								</span>
							</Button>
						) : (
							<Button variant="outline" onClick={() => void check()} disabled={checking}>
								{checking ? "Checking..." : updateInfo ? `Update v${updateInfo.version}` : "Check for update"}
								{checking ? (
									<span data-icon="inline-end">
										<Spinner />
									</span>
								) : null}
							</Button>
						)}
				</SettingsRow>
				<SettingsSelect configKey="app.channel" defaultValue="stable" label="Update channel" options={CHANNEL_OPTIONS} />
				<SettingsRow label="Logs" description="Open the app logs folder on disk (errors and warnings in production).">
					<Button variant="outline" disabled={openingLogs} onClick={() => void openLogsFolder()}>
						<span data-icon="inline-start">
							<RiFolderOpenLine className="size-4" />
						</span>
						{openingLogs ? "Opening..." : "Open logs folder"}
					</Button>
				</SettingsRow>
			</SettingsGroup>
		</>
	);
}
