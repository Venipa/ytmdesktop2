import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { SettingsInlineEditor } from "@/components/settings-inline-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { useSettingsState } from "@/hooks/use-settings";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/_settings/api-integrations/api")({
	component: ApiSettingsPage,
});

function ApiSettingsPage() {
	const [apiEnabled, setApiEnabled, { isPending: apiPending }] = useSettingsState("api.enabled", false);
	const statusQuery = trpc.api.status.useQuery(undefined, { refetchInterval: 5_000 });

	const port = statusQuery.data?.port ?? 13091;
	const running = statusQuery.data?.running === true;
	const endpoint = useMemo(() => `http://127.0.0.1:${port}`, [port]);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					Local API
					<Badge variant="outline">Experimental</Badge>
				</CardTitle>
				<CardDescription>HTTP API for Stream Deck, Remote, and other local integrations.</CardDescription>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<SettingsCheckbox configKey="api.enabled" description="Starts the local HTTP server." updateMessage="API setting updated">
						Enable API
					</SettingsCheckbox>
					{apiEnabled && !apiPending && (
						<SettingsInlineEditor
							configKey="api.port"
							type="number"
							defaultValue={13091}
							placeholder="9999-39999"
							label="API Port"
							hint="Port between 9999 and 39999. Restart needed if API already running."
							updateMessage="API port updated"
							min={9999}
							max={39999}
							rules={[{ kind: "number", min: 9999, max: 39999, integer: true }]}
							parse={(raw) => Number(raw)}
						/>
					)}
				</FieldGroup>
			</CardContent>
			<CardFooter className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<span>Status:</span>
					<Badge variant={running ? "default" : "secondary"}>{running ? "Running" : "Stopped"}</Badge>
					{apiEnabled && <span className="font-mono">{endpoint}</span>}
				</div>
				{!apiEnabled && (
					<Button
						size="sm"
						disabled={apiPending}
						onClick={() => {
							setApiEnabled(true);
						}}
					>
						Enable API
					</Button>
				)}
			</CardFooter>
		</Card>
	);
}
