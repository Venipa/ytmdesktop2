import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_settings/api-integrations/remote")({
	component: RemoteSettingsPage,
});

function RemoteSettingsPage() {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					Remote
					<Badge variant="secondary">Coming soon</Badge>
				</CardTitle>
				<CardDescription>Authorize a mobile companion by scanning a QR code.</CardDescription>
			</CardHeader>
			<CardContent className="text-sm text-muted-foreground">
				<p>Remote pairing will use the same global authentication unit as Stream Deck and the local API.</p>
			</CardContent>
		</Card>
	);
}
