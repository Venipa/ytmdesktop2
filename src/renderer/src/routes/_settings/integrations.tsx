import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useLastFm } from "@/hooks/use-lastfm";

export const Route = createFileRoute("/_settings/integrations")({
	component: IntegrationsSettingsPage,
});

function IntegrationsSettingsPage() {
	const { lastFM, isBusy, toggleLastFM } = useLastFm();

	return (
		<Card>
			<CardHeader>
				<CardTitle>Integrations</CardTitle>
				<CardDescription>Connect external services to enrich your listening.</CardDescription>
			</CardHeader>
			<CardContent>
				<Field orientation="horizontal" data-disabled={isBusy || undefined}>
					<FieldContent>
						<FieldLabel>Last.fm</FieldLabel>
						<FieldDescription>
							{lastFM?.connected && lastFM.name ? `Connected as ${lastFM.name}` : "Scrobble tracks to your Last.fm profile."}
						</FieldDescription>
					</FieldContent>
					<Switch checked={!!lastFM?.connected} disabled={isBusy} onCheckedChange={(next) => void toggleLastFM(next)} />
				</Field>
			</CardContent>
		</Card>
	);
}
