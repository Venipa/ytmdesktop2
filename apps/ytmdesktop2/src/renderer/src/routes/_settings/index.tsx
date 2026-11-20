import { createFileRoute } from "@tanstack/react-router";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { SettingsGroup } from "@/components/settings-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettingsState } from "@/hooks/use-settings";

export const Route = createFileRoute("/_settings/")({
	component: GenericSettingsPage,
});

function GenericSettingsPage() {
	const [getStartedEnabled, setGetStartedEnabled, { isPending: getStartedPending }] = useSettingsState("app.getstarted", false);
	const [appAutostartEnabled, , { isPending: autostartPending }] = useSettingsState("app.autostart", false);

	return (
		<>
			{getStartedEnabled && (
				<Card>
					<CardHeader>
						<CardTitle>Get Started</CardTitle>
						<CardDescription>
							Welcome to YouTube Music for Desktop. Adjust settings and personalize your experience.
						</CardDescription>
					</CardHeader>
					<CardFooter className="justify-between gap-2">
						<a href="https://youtube-music.app/" target="_blank" rel="noreferrer" className="text-xs text-primary underline-offset-4 hover:underline">
							Learn more
						</a>
						<Button variant="ghost" size="sm" disabled={getStartedPending} onClick={() => setGetStartedEnabled(false)}>
							Don't show again
						</Button>
					</CardFooter>
				</Card>
			)}

			<SettingsGroup title="Application">
				<SettingsCheckbox configKey="app.autostart" description="Launch YouTube Music when you sign in.">
					Enable autostart
				</SettingsCheckbox>
				<SettingsCheckbox configKey="app.autostartMinimized" nested disabled={!appAutostartEnabled || autostartPending}>
					Start minimized
				</SettingsCheckbox>
				<SettingsCheckbox configKey="app.minimizeTrayOverride" description="Close window to tray instead of quitting.">
					Minimize to tray on close
				</SettingsCheckbox>
				<SettingsCheckbox configKey="app.disableHardwareAccel" description="Requires an app restart to apply.">
					Disable hardware acceleration
				</SettingsCheckbox>
			</SettingsGroup>

			<SettingsGroup title="Updates & privacy">
				<SettingsCheckbox configKey="app.autoupdate">Enable autoupdate</SettingsCheckbox>
				<SettingsCheckbox
					configKey="app.enableStatisticsAndErrorTracing"
					description="Allows faster bug fixing via anonymized error reports."
				>
					Allow anonymized error reporting
				</SettingsCheckbox>
			</SettingsGroup>

			<SettingsGroup
				title={
					<>
						Developer
						<Badge variant="destructive">Caution</Badge>
					</>
				}
				description="Advanced tools for debugging. Do not paste unknown scripts into the console."
			>
				<SettingsCheckbox configKey="app.enableDev" description="Enables developer tools for testing additional functionality.">
					Enable developer mode
				</SettingsCheckbox>
			</SettingsGroup>
		</>
	);
}
