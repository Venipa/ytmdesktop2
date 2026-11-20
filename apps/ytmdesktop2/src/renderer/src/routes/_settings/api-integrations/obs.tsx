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
import { SettingsAdvanced, SettingsDescription, SettingsGroup, SettingsGroupBody, SettingsRow, settingsLabelClass } from "@/components/settings-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const LAYOUT_ITEMS = Object.fromEntries(LAYOUT_OPTIONS.map((o) => [o.value, o.label]));

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

	const clientItems = useMemo(() => Object.fromEntries(clients.map((c) => [c.appId, c.appName || c.appId])), [clients]);
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
			<SettingsGroup
				title={
					<>
						OBS overlay
						<Badge variant="outline">Embed</Badge>
					</>
				}
				description="First-party now-playing browser source for OBS. Preview uses live player data; OBS hits the local API."
			>
				<SettingsGroupBody>
					<ol className="list-decimal space-y-1.5 pl-4 text-xs/5 text-muted-foreground">
						<li>
							Enable the API under <span className="font-medium text-foreground">API</span>
							{apiEnabled ? null : " (currently off)"}.
						</li>
						<li>Tune the layout and elements below — preview updates immediately.</li>
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

				</SettingsGroupBody>
				<SettingsRow label="Layout" description={LAYOUT_OPTIONS.find((o) => o.value === flags.layout)?.hint ?? "Widget layout variant."}>
					<Select
						value={flags.layout}
						items={LAYOUT_ITEMS}
						onValueChange={(next) => {
							if (next == null) return;
							setFlags((prev) => ({ ...prev, layout: next as EmbedLayout }));
						}}
					>
						<SelectTrigger className="w-44 shrink-0">
							<SelectValue />
						</SelectTrigger>
						<SelectContent alignItemWithTrigger sideOffset={0}>
							<SelectGroup>
								{LAYOUT_OPTIONS.map((opt) => (
									<SelectItem key={opt.value} value={opt.value} label={opt.label}>
										{opt.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</SettingsRow>
				<SettingsAdvanced label="Elements" summary={`${FLAG_ROWS.length + 1} settings`}>
					{FLAG_ROWS.map((row) => (
						<SettingsRow key={row.key} label={row.label} description={row.description}>
							<Switch checked={flags[row.key] === true} onCheckedChange={(checked) => setFlag(row.key, checked === true)} />
						</SettingsRow>
					))}
					<SettingsRow label="Scale" description="CSS scale factor (0.25–4).">
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
					</SettingsRow>
				</SettingsAdvanced>
			</SettingsGroup>

			<SettingsGroup
				title="Browser source"
				action={
					<div className="flex items-center gap-3">
						{apiEnabled && running ? (
							<a href={embedUrl} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
								Open in browser
							</a>
						) : null}
						<Button type="button" size="sm" onClick={() => void copyUrl()}>
							Copy OBS URL
						</Button>
					</div>
				}
			>
				{authRequired ? (
					<SettingsGroupBody className="gap-2">
						<div className="flex flex-col gap-0.5">
							<span className={settingsLabelClass}>API token</span>
							<SettingsDescription>
								Required when authorization is on. Appended as <span className="font-mono">?token=</span>.
							</SettingsDescription>
						</div>
						<div className="flex flex-wrap gap-2">
							<Input
								className="min-w-[12rem] flex-1 font-mono text-xs"
								placeholder="Paste token…"
								value={token}
								onChange={(e) => setToken(e.target.value)}
								spellCheck={false}
							/>
							{clients.length > 0 ? (
								<>
									<Select value={selectedClientId} items={clientItems} onValueChange={(next) => next != null && setSelectedClientId(next)}>
										<SelectTrigger className="w-40">
											<SelectValue />
										</SelectTrigger>
										<SelectContent alignItemWithTrigger sideOffset={0}>
											<SelectGroup>
												{clients.map((c) => (
													<SelectItem key={c.appId} value={c.appId} label={c.appName || c.appId}>
														{c.appName || c.appId}
													</SelectItem>
												))}
											</SelectGroup>
										</SelectContent>
									</Select>
									<Button type="button" size="sm" variant="secondary" disabled={revealing} onClick={() => void loadTokenFromClient()}>
										Load token
									</Button>
								</>
							) : (
								<p className="self-center text-xs text-muted-foreground">No paired clients — create one under Authentication.</p>
							)}
						</div>
					</SettingsGroupBody>
				) : null}
				<SettingsGroupBody className="gap-1">
					<span className="text-xs/4 text-muted-foreground">Browser source URL</span>
					<code className="block break-all font-mono text-xs text-foreground select-text">{embedUrl}</code>
					{!apiEnabled || !running ? (
						<p className="mt-1 text-xs text-amber-500">Local API is not running — preview still works; OBS needs the API.</p>
					) : null}
				</SettingsGroupBody>
			</SettingsGroup>
		</>
	);
}
