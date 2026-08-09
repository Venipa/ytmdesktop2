import {
	buildNowPlayingEmbedUrl,
	defaultEmbedFlags,
	type EmbedFlags,
	type EmbedLayout,
	mapTrackToViewModel,
	NowPlayingWidget,
} from "@shared/embeds";
import { toAppThumbUrl } from "@shared/media/appThumbUrl";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTrack, useTrackState } from "@/hooks/use-track";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/_settings/api-integrations/obs")({
	component: ObsSettingsPage,
});

type BoolFlagKey = Exclude<keyof EmbedFlags, "scale" | "layout">;

const LAYOUT_OPTIONS: { value: EmbedLayout; label: string; hint: string }[] = [
	{ value: "default", label: "Default", hint: "Full card with art + progress." },
	{ value: "compact", label: "Compact", hint: "Smaller card, tighter spacing." },
	{ value: "text", label: "Text only", hint: "Title + artist, no art/progress." },
	{ value: "badge", label: "Badge", hint: "Compact horizontal card (same radius as default)." },
	{ value: "fullscreen", label: "Fullscreen", hint: "Edge-to-edge art + overlay text (fill Browser Source)." },
	{ value: "stack", label: "Stack", hint: "Vertical poster — art on top." },
	{ value: "ticker", label: "Ticker", hint: "Thin scrolling strip for top/bottom." },
];

const FLAG_ROWS: { key: BoolFlagKey; label: string; description: string }[] = [
	{ key: "art", label: "Album art", description: "Show track thumbnail (ignored for text layout)." },
	{ key: "title", label: "Title", description: "Show track title." },
	{ key: "artist", label: "Artist", description: "Show artist name." },
	{ key: "progress", label: "Progress", description: "Show progress bar (hidden on text/badge/ticker)." },
	{ key: "transparent", label: "Transparent", description: "OBS-friendly transparent background." },
];

function ObsSettingsPage() {
	const track = useTrack();
	const trackState = useTrackState();
	const statusQuery = trpc.api.status.useQuery(undefined, { refetchInterval: 5_000 });
	const authQuery = trpc.auth.status.useQuery(undefined, { refetchInterval: 5_000 });
	const { mutateAsync: revealToken, isLoading: revealing } = trpc.auth.revealToken.useMutation();

	const [flags, setFlags] = useState<EmbedFlags>(() => defaultEmbedFlags());
	const [token, setToken] = useState("");
	const [selectedClientId, setSelectedClientId] = useState<string>("");

	const port = statusQuery.data?.port ?? 13091;
	const apiEnabled = statusQuery.data?.enabled === true;
	const running = statusQuery.data?.running === true;
	const authRequired = authQuery.data?.authRequired === true;
	const clients = authQuery.data?.clients ?? [];

	const viewModel = useMemo(() => {
		const mapped = mapTrackToViewModel(track, trackState);
		if (!mapped) return null;
		return {
			...mapped,
			thumbnailUrl: toAppThumbUrl(mapped.thumbnailUrl) ?? mapped.thumbnailUrl,
		};
	}, [track, trackState]);

	const endpoint = useMemo(() => `http://127.0.0.1:${port}`, [port]);
	const embedUrl = useMemo(
		() =>
			buildNowPlayingEmbedUrl(endpoint, {
				...flags,
				token: authRequired ? token.trim() || null : null,
			}),
		[endpoint, flags, authRequired, token],
	);

	useEffect(() => {
		if (!selectedClientId && clients[0]?.appId) {
			setSelectedClientId(clients[0].appId);
		}
	}, [clients, selectedClientId]);

	const setFlag = (key: BoolFlagKey, value: boolean) => {
		setFlags((prev) => ({ ...prev, [key]: value }));
	};

	const copyUrl = async () => {
		if (!apiEnabled || !running) {
			toast.error("Enable the local API first");
			return;
		}
		if (authRequired && !token.trim()) {
			toast.error("Paste or load a client token — auth is required");
			return;
		}
		await navigator.clipboard.writeText(embedUrl);
		toast.success("OBS URL copied");
	};

	const loadTokenFromClient = async () => {
		if (!selectedClientId) {
			toast.error("No paired client selected");
			return;
		}
		try {
			const next = await revealToken({ appId: selectedClientId });
			if (!next) {
				toast.error("No token found for this client");
				return;
			}
			setToken(next);
			toast.success("Token loaded into URL");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to load token");
		}
	};

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						OBS overlay
						<Badge variant="outline">Embed</Badge>
					</CardTitle>
					<CardDescription>
						First-party now-playing browser source for OBS. Preview uses live player data; OBS hits the local API.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
						<li>
							Enable the API under <span className="font-medium text-foreground">API</span>
							{apiEnabled ? null : " (currently off)"}.
						</li>
						<li>Tune flags below — preview updates immediately.</li>
						<li>
							{authRequired
								? "Load a paired client token (or paste one), then copy the URL into an OBS Browser Source."
								: "Copy the URL into an OBS Browser Source (width ~480, height ~140)."}
						</li>
					</ol>

					<div
						className="relative flex min-h-[140px] items-center justify-center overflow-hidden rounded-lg border border-border p-4"
						style={{
							backgroundImage:
								"linear-gradient(45deg, #1a1a1c 25%, transparent 25%), linear-gradient(-45deg, #1a1a1c 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a1c 75%), linear-gradient(-45deg, transparent 75%, #1a1a1c 75%)",
							backgroundSize: "16px 16px",
							backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
							backgroundColor: "#0c0c0e",
							minHeight: flags.layout === "fullscreen" ? 220 : flags.layout === "stack" ? 320 : 140,
							alignItems: flags.layout === "fullscreen" ? "stretch" : "center",
							padding: flags.layout === "fullscreen" ? 0 : undefined,
						}}
					>
						{flags.layout === "fullscreen" ? (
							<div className="h-[220px] w-full overflow-hidden">
								<NowPlayingWidget track={viewModel} flags={flags} />
							</div>
						) : (
							<NowPlayingWidget track={viewModel} flags={flags} />
						)}
					</div>

					<FieldGroup>
						<Field orientation="horizontal" className="items-center justify-between gap-4">
							<FieldContent>
								<FieldLabel>Layout</FieldLabel>
								<FieldDescription>
									{LAYOUT_OPTIONS.find((o) => o.value === flags.layout)?.hint ?? "Widget layout variant."}
								</FieldDescription>
							</FieldContent>
							<select
								className="h-8 rounded-md border border-input bg-background px-2 text-xs"
								value={flags.layout}
								onChange={(e) => {
									const layout = e.target.value as EmbedLayout;
									setFlags((prev) => ({ ...prev, layout }));
								}}
							>
								{LAYOUT_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
						</Field>
						{FLAG_ROWS.map((row) => (
							<Field key={row.key} orientation="horizontal" className="items-center justify-between gap-4">
								<FieldContent>
									<FieldLabel>{row.label}</FieldLabel>
									<FieldDescription>{row.description}</FieldDescription>
								</FieldContent>
								<Switch
									checked={flags[row.key] === true}
									onCheckedChange={(checked) => setFlag(row.key, checked === true)}
								/>
							</Field>
						))}
						<Field orientation="horizontal" className="items-center justify-between gap-4">
							<FieldContent>
								<FieldLabel>Scale</FieldLabel>
								<FieldDescription>CSS scale factor (0.25–4).</FieldDescription>
							</FieldContent>
							<Input
								type="number"
								className="w-24"
								min={0.25}
								max={4}
								step={0.05}
								value={flags.scale}
								onChange={(e) => {
									const n = Number(e.target.value);
									if (!Number.isFinite(n)) return;
									setFlags((prev) => ({
										...prev,
										scale: Math.min(4, Math.max(0.25, n)),
									}));
								}}
							/>
						</Field>
					</FieldGroup>

					{authRequired ? (
						<FieldGroup>
							<Field>
								<FieldLabel>API token</FieldLabel>
								<FieldDescription>
									Required when authorization is on. Appended as <span className="font-mono">?token=</span>.
								</FieldDescription>
								<div className="mt-2 flex flex-wrap gap-2">
									<Input
										className="min-w-[12rem] flex-1 font-mono text-xs"
										placeholder="Paste token…"
										value={token}
										onChange={(e) => setToken(e.target.value)}
										spellCheck={false}
									/>
									{clients.length > 0 ? (
										<>
											<select
												className="h-8 rounded-md border border-input bg-background px-2 text-xs"
												value={selectedClientId}
												onChange={(e) => setSelectedClientId(e.target.value)}
											>
												{clients.map((c) => (
													<option key={c.appId} value={c.appId}>
														{c.appName || c.appId}
													</option>
												))}
											</select>
											<Button type="button" size="sm" variant="secondary" disabled={revealing} onClick={() => void loadTokenFromClient()}>
												Load token
											</Button>
										</>
									) : (
										<p className="text-xs text-muted-foreground">No paired clients — create one under Authentication.</p>
									)}
								</div>
							</Field>
						</FieldGroup>
					) : null}

					<div className="rounded-md border border-border bg-muted/30 p-3">
						<p className="mb-1 text-xs text-muted-foreground">Browser source URL</p>
						<code className="block break-all font-mono text-xs text-foreground">{embedUrl}</code>
						{!apiEnabled || !running ? (
							<p className="mt-2 text-xs text-amber-500">Local API is not running — preview still works; OBS needs the API.</p>
						) : null}
					</div>
				</CardContent>
				<CardFooter className="flex flex-wrap gap-2">
					<Button type="button" size="sm" onClick={() => void copyUrl()}>
						Copy OBS URL
					</Button>
					{apiEnabled && running ? (
						<a
							href={embedUrl}
							target="_blank"
							rel="noreferrer"
							className="text-xs text-primary underline-offset-4 hover:underline"
						>
							Open in browser
						</a>
					) : null}
				</CardFooter>
			</Card>
		</>
	);
}
