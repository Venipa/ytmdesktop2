import type { AppRouter } from "@main/trpc/router";
import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";

type LastFmStatus = NonNullable<inferRouterOutputs<AppRouter>["lastfm"]["status"]>;

export const Route = createFileRoute("/_settings/integrations")({
	component: IntegrationsSettingsPage,
});

function IntegrationsSettingsPage() {
	const [lastFM, setLastFM] = useState<LastFmStatus>({ connected: false, name: null, error: false, processing: false });
	const { mutateAsync: toggle, isPending: togglePending } = trpc.lastfm.toggle.useMutation({
		onSuccess: (status) => setLastFM(status as LastFmStatus),
	});

	trpc.lastfm.status.useQuery(undefined, {
		onSuccess: (status) => setLastFM(status),
	});

	trpc.lastfm.onStatus.useSubscription(undefined, {
		onData: (status) => setLastFM(status as LastFmStatus),
	});

	const busy = togglePending || !!lastFM?.processing;

	function handleToggleLastFM(next: boolean) {
		if (busy) return;
		void toggle(next);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Integrations</CardTitle>
				<CardDescription>Connect external services to enrich your listening.</CardDescription>
			</CardHeader>
			<CardContent>
				<Field orientation="horizontal" data-disabled={busy || undefined}>
					<FieldContent>
						<FieldLabel>Last.fm</FieldLabel>
						<FieldDescription>
							{lastFM?.connected && lastFM.name ? `Connected as ${lastFM.name}` : "Scrobble tracks to your Last.fm profile."}
						</FieldDescription>
					</FieldContent>
					<Switch checked={!!lastFM?.connected} disabled={busy} onCheckedChange={handleToggleLastFM} />
				</Field>
			</CardContent>
		</Card>
	);
}
