import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useLastFm } from "@/hooks/use-lastfm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_settings/lastfm")({
	component: LastFmSettingsPage,
});

function LastFmSettingsPage() {
	const { lastFM, enabled, isBusy, toggleLastFM } = useLastFm();

	const statusLabel = lastFM.connected
		? lastFM.name
			? `Connected as ${lastFM.name}`
			: "Connected"
		: lastFM.processing
			? "Waiting for authorization…"
			: lastFM.error
				? "Connection error"
				: enabled
					? "Not connected"
					: "Disconnected";

	return (
		<Card>
			<CardHeader>
				<CardTitle>Last.fm</CardTitle>
				<CardDescription>Scrobble tracks to your Last.fm profile.</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<Field orientation="horizontal" data-disabled={isBusy || undefined}>
					<FieldContent>
						<FieldLabel>Enable Last.fm</FieldLabel>
						<FieldDescription>Connect to scrobble your listening history.</FieldDescription>
					</FieldContent>
					<Switch
						checked={enabled}
						disabled={isBusy && !enabled}
						onCheckedChange={(next) => {
							if (next === enabled) return;
							void toggleLastFM(next);
						}}
					/>
				</Field>
				<p
					className={cn(
						"text-xs",
						lastFM.connected && "text-green-500",
						lastFM.error && !lastFM.connected && "text-destructive",
						!lastFM.connected && !lastFM.error && "text-muted-foreground",
					)}
				>
					Status: {statusLabel}
				</p>
			</CardContent>
		</Card>
	);
}
