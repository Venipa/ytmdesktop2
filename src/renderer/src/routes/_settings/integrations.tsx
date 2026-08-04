import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SectionCard } from "@/components/section-card";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";

type LastFmStatus = { connected: boolean; name: string | null; error: string | null; processing?: boolean };

export const Route = createFileRoute("/_settings/integrations")({
	component: IntegrationsSettingsPage,
});

function IntegrationsSettingsPage() {
	const [lastFM, setLastFM] = useState<LastFmStatus>({ connected: false, name: null, error: null, processing: false });
	const toggleLastFm = trpc.lastfm.toggle.useMutation({
		onSuccess: (status) => setLastFM(status as LastFmStatus),
	});

	trpc.lastfm.status.useQuery(undefined, {
		onSuccess: (status) => setLastFM(status as LastFmStatus),
	});

	trpc.lastfm.onStatus.useSubscription(undefined, {
		onData: (status) => setLastFM(status as LastFmStatus),
	});

	function handleToggleLastFM() {
		if (toggleLastFm.isPending || lastFM?.processing) return;
		toggleLastFm.mutate(!lastFM?.connected);
	}

	return (
		<div>
			<SectionCard loading={toggleLastFm.isPending || lastFM?.processing} className="cursor-pointer" onClick={handleToggleLastFM}>
				<div className="grid grid-cols-[1fr_100px]">
					<div className="flex flex-col">
						<h1 className="font-semibold">LastFM</h1>
						<p className="text-sm text-muted-foreground">manage your last fm connection</p>
					</div>
					<div className="flex items-center justify-center">
						<Switch checked={!!lastFM?.connected} className="pointer-events-none" />
					</div>
				</div>
			</SectionCard>
		</div>
	);
}
