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
						<SettingsCheckbox configKey="app.beta" description="Include pre-release builds when checking for updates.">
							Include Pre Releases / Beta
						</SettingsCheckbox>
					</FieldGroup>
				</CardContent>
			</Card>
		</>
	);
}
