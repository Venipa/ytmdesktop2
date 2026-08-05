import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { SettingsInput } from "@/components/settings-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useSettingsState } from "@/hooks/use-settings";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/_settings/streamdeck")({
	component: StreamDeckSettingsPage,
});

function StreamDeckSettingsPage() {
	const [apiEnabled, setApiEnabled, { isPending: apiPending }] = useSettingsState("api.enabled", false);
	const [authRequired, setAuthRequired, { isPending: authPending }] = useSettingsState("api.authRequired", false);
	const [pending, setPending] = useState<{ id: string; appId: string; appName: string; appVersion: string; code: string } | null>(null);
	const [clients, setClients] = useState<Array<{ appId: string; appName: string; appVersion: string; createdAt: number }>>([]);

	const statusQuery = trpc.api.status.useQuery(undefined, {
		refetchInterval: 5_000,
		onSuccess: (data) => {
			setPending(data.pending?.[0] ?? null);
			setClients(data.clients ?? []);
		},
	});

	trpc.api.onPending.useSubscription(undefined, {
		onData: (next) => setPending(next),
	});

	trpc.api.onClients.useSubscription(undefined, {
		onData: (next) => setClients(next),
	});

	const { mutateAsync: approve, isLoading: approving } = trpc.api.approve.useMutation({
		onSuccess: () => {
			setPending(null);
			void statusQuery.refetch();
		},
	});
	const { mutateAsync: deny, isLoading: denying } = trpc.api.deny.useMutation({
		onSuccess: () => {
			setPending(null);
			void statusQuery.refetch();
		},
	});
	const { mutateAsync: revoke, isLoading: revoking } = trpc.api.revoke.useMutation({
		onSuccess: () => void statusQuery.refetch(),
	});
	const { mutateAsync: revokeAll, isLoading: revokingAll } = trpc.api.revokeAll.useMutation({
		onSuccess: () => {
			setClients([]);
			void statusQuery.refetch();
		},
	});

	const port = statusQuery.data?.port ?? 13091;
	const running = statusQuery.data?.running === true;
	const busy = approving || denying || revoking || revokingAll;

	const enableForStreamDeck = useCallback(() => {
		if (!apiEnabled) setApiEnabled(true);
		if (!authRequired) setAuthRequired(true);
	}, [apiEnabled, authRequired, setApiEnabled, setAuthRequired]);

	const endpoint = useMemo(() => `http://127.0.0.1:${port}`, [port]);

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						Stream Deck
						<Badge variant="outline">Integration</Badge>
					</CardTitle>
					<CardDescription>Control YouTube Music from your Elgato Stream Deck via the local API.</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<SettingsCheckbox
							configKey="api.enabled"
							description="Required for Stream Deck. Starts the local HTTP API."
							updateMessage="API setting updated"
						>
							Enable API
						</SettingsCheckbox>
						{apiEnabled && !apiPending && (
							<>
								<SettingsInput
									configKey="api.port"
									type="number"
									min={13000}
									max={39999}
									defaultValue={13091}
									placeholder="13000-39999"
									label="API Port"
									debounce={800}
									updateMessage="API port updated"
								/>
								<SettingsCheckbox
									configKey="api.authRequired"
									description="Require paired clients (recommended for Stream Deck)."
									updateMessage="API auth setting updated"
								>
									Require authorization
								</SettingsCheckbox>
							</>
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
						<Button size="sm" disabled={apiPending} onClick={enableForStreamDeck}>
							Enable for Stream Deck
						</Button>
					)}
				</CardFooter>
			</Card>

			{pending && (
				<Card className="border-primary/40">
					<CardHeader>
						<CardTitle>Authorize Stream Deck</CardTitle>
						<CardDescription>
							Compare this code with the one shown in the Stream Deck property inspector, then allow access.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<div className="rounded-lg bg-muted px-4 py-6 text-center">
							<p className="text-3xl font-semibold tracking-[0.35em]">{pending.code}</p>
							<p className="mt-2 text-sm text-muted-foreground">
								{pending.appName} <span className="font-mono text-xs">({pending.appId})</span> · v{pending.appVersion}
							</p>
						</div>
						<div className="flex gap-2">
							<Button className="flex-1" disabled={busy} onClick={() => void approve({ id: pending.id })}>
								Allow
							</Button>
							<Button className="flex-1" variant="outline" disabled={busy} onClick={() => void deny({ id: pending.id })}>
								Deny
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			<Card>
				<CardHeader>
					<CardTitle>Paired clients</CardTitle>
					<CardDescription>
						{authRequired || authPending
							? "Authorized apps that can control playback."
							: "Authorization is optional while Require authorization is off."}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{clients.length === 0 ? (
						<p className="text-sm text-muted-foreground">No paired clients yet.</p>
					) : (
						<ul className="flex flex-col gap-3">
							{clients.map((client) => (
								<li key={client.appId}>
									<Field orientation="horizontal">
										<FieldContent>
											<FieldLabel>{client.appName}</FieldLabel>
											<FieldDescription>
												<span className="font-mono">{client.appId}</span> · v{client.appVersion}
											</FieldDescription>
										</FieldContent>
										<Button
											size="sm"
											variant="ghost"
											disabled={busy}
											onClick={() => void revoke({ appId: client.appId })}
										>
											Revoke
										</Button>
									</Field>
								</li>
							))}
						</ul>
					)}
				</CardContent>
				{clients.length > 0 && (
					<CardFooter>
						<Button size="sm" variant="outline" disabled={busy} onClick={() => void revokeAll()}>
							Revoke all
						</Button>
					</CardFooter>
				)}
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Setup</CardTitle>
					<CardDescription>Install the YTMDesktop2 Stream Deck plugin, then pair it once.</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
					<ol className="list-decimal space-y-2 pl-4">
						<li>Enable the API above (and Require authorization).</li>
						<li>
							Install the plugin from the <span className="font-mono">packages/streamdeck/</span> package (
							<span className="font-mono">pnpm --dir packages/streamdeck pack</span>), or load it in Stream Deck developer mode.
						</li>
						<li>Add a YTMDesktop2 action, open its settings, set host <span className="font-mono">127.0.0.1</span> and port {port}.</li>
						<li>Press Authorize in the plugin — approve the code shown here.</li>
					</ol>
				</CardContent>
				<CardFooter>
					<a
						href="https://docs.elgato.com/streamdeck/sdk/introduction/getting-started/"
						target="_blank"
						rel="noreferrer"
						className="text-xs text-primary underline-offset-4 hover:underline"
					>
						Stream Deck plugin docs
					</a>
				</CardFooter>
			</Card>
		</>
	);
}
