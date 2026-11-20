import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { SettingsGroup } from "@/components/settings-group";
import { SettingsInlineEditor } from "@/components/settings-inline-editor";
import { Badge } from "@/components/ui/badge";
import { useSettingsState } from "@/hooks/use-settings";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/_settings/api-integrations/api")({
	component: ApiSettingsPage,
});

function ApiSettingsPage() {
	const [apiEnabled, , { isPending: apiPending }] = useSettingsState("api.enabled", false);
	const statusQuery = trpc.api.status.useQuery(undefined, { refetchInterval: 5_000 });

	const port = statusQuery.data?.port ?? 13091;
	const running = statusQuery.data?.running === true;
	const endpoint = useMemo(() => `http://127.0.0.1:${port}`, [port]);

	return (
		<SettingsGroup
			title={
				<>
					Local API
					<Badge variant="outline">Experimental</Badge>
				</>
			}
			description="HTTP API for Stream Deck, Remote, and other local integrations."
			footer={
				<div className="flex items-center gap-2">
					<span>Status:</span>
					<Badge variant={running ? "default" : "secondary"}>{running ? "Running" : "Stopped"}</Badge>
					{apiEnabled && <span className="font-mono">{endpoint}</span>}
				</div>
			}
		>
			<SettingsCheckbox configKey="api.enabled" description="Starts the local HTTP server." updateMessage="API setting updated">
				Enable API
			</SettingsCheckbox>
			<SettingsInlineEditor
				configKey="api.port"
				type="number"
				defaultValue={13091}
				placeholder="9999-39999"
				label="API port"
				hint="Port between 9999 and 39999. API will restart once changed."
				updateMessage="API port updated"
				min={9999}
				max={39999}
				rules={[{ kind: "number", min: 9999, max: 39999, integer: true }]}
				parse={(raw) => Number(raw)}
				nested
				disabled={!apiEnabled || apiPending}
			/>
		</SettingsGroup>
	);
}
