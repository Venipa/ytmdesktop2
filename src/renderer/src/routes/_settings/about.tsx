import { createFileRoute } from "@tanstack/react-router";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useUpdater } from "@/hooks/use-updater";

export const Route = createFileRoute("/_settings/about")({
	component: AboutSettingsPage,
});

function AboutSettingsPage() {
	const appVersion = window.api.version;
	const { updateInfo, downloaded, progress, checking, installing, check, install } = useUpdater();

	function handleCheckUpdate() {
		if (checking) return;
		void check();
	}

	function runUpdate() {
		if (installing) return;
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
						{updateInfo && downloaded ? (
							<Button variant="outline" onClick={runUpdate} disabled={installing}>
								Install {updateInfo.version}
							</Button>
						) : updateInfo && progress?.percent ? (
							<Button variant="outline" disabled>
								Downloading… {progress.percent.toFixed(0)}%
								<span data-icon="inline-end">
									<Spinner />
								</span>
							</Button>
						) : (
							<Button variant="outline" onClick={handleCheckUpdate} disabled={checking}>
								{checking ? "Checking…" : "Check for Update"}
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
						<SettingsCheckbox configKey="app.beta" description="Include pre-release builds when checking for updates.">
							Include Pre Releases / Beta
						</SettingsCheckbox>
					</FieldGroup>
				</CardContent>
			</Card>
		</>
	);
}
