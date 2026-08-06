import { UPDATE_CHANNEL_LABELS, type UpdateChannel } from "@shared/utils/updater";
import { createFileRoute } from "@tanstack/react-router";
import { SettingsSelect } from "@/components/settings-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useUpdater } from "@/hooks/use-updater";

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
								{status === "installing" ? "Installing…" : `Downloading… ${(progress?.percent ?? 0).toFixed(0)}%`}
								<span data-icon="inline-end">
									<Spinner />
								</span>
							</Button>
						) : (
							<Button variant="outline" onClick={() => void check()} disabled={checking}>
								{checking ? "Checking…" : updateInfo ? `Update v${updateInfo.version}` : "Check for Update"}
								{checking ? (
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
						<SettingsSelect configKey="app.channel" defaultValue="stable" label="Update channel" options={CHANNEL_OPTIONS} />
					</FieldGroup>
				</CardContent>
			</Card>
		</>
	);
}
