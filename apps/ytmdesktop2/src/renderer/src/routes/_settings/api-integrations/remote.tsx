import { createFileRoute } from "@tanstack/react-router";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_settings/api-integrations/remote")({
	component: RemoteSettingsPage,
});

function RemoteSettingsPage() {
	return (
		<SettingsGroup
			title={
				<>
					Remote
					<Badge variant="secondary">Coming soon</Badge>
				</>
			}
			description="Authorize a mobile companion by scanning a QR code."
		>
			<SettingsRow description="Remote pairing will use the same global authentication unit as Stream Deck and the local API." />
		</SettingsGroup>
	);
}
