import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useLastFm } from "@/hooks/use-lastfm";

export const Route = createFileRoute("/_settings/lastfm")({
	component: LastFmSettingsPage,
});

function LastFmSettingsPage() {
	const { lastFM, isBusy, toggleLastFM } = useLastFm();

	return (
		<Card>
			<CardHeader>
				<CardTitle>Last.fm</CardTitle>
				<CardDescription>Scrobble tracks to your Last.fm profile.</CardDescription>
			</CardHeader>
			<CardContent>
				<Field orientation="horizontal" data-disabled={isBusy || undefined}>
					<FieldContent>
						<FieldLabel>Enable Last.fm</FieldLabel>
						<FieldDescription>
							{lastFM?.connected && lastFM.name ? `Connected as ${lastFM.name}` : "Connect to scrobble your listening history."}
						</FieldDescription>
					</FieldContent>
					<Switch checked={!!lastFM?.connected} disabled={isBusy} onCheckedChange={(next) => void toggleLastFM(next)} />
				</Field>
			</CardContent>
		</Card>
	);
}
