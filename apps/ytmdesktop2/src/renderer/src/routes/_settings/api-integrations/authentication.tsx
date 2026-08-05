import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSettingsState } from "@/hooks/use-settings";
import { trpc } from "@/lib/trpc";

type RevokeTarget = "all" | { appId: string; appName: string };

export const Route = createFileRoute("/_settings/api-integrations/authentication")({
	component: AuthenticationSettingsPage,
});

function slugifyAppId(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "")
		.slice(0, 32);
}

function AuthenticationSettingsPage() {
	const utils = trpc.useUtils();
	const [, , { isPending: authPending }] = useSettingsState("api.authRequired", false);
	const [wizardOpen, setWizardOpen] = useState(false);
	const [revokeTarget, setRevokeTarget] = useState<RevokeTarget | null>(null);

	const statusQuery = trpc.auth.status.useQuery(undefined, {
		refetchInterval: 5_000,
	});

	trpc.auth.onPending.useSubscription(undefined, {
		onData: (next) => {
			utils.auth.status.setData(undefined, (old) => {
				if (!old) return old;
				return { ...old, pending: next ? [next] : [] };
			});
		},
	});

	trpc.auth.onClients.useSubscription(undefined, {
		onData: (next) => {
			utils.auth.status.setData(undefined, (old) => {
				if (!old) return old;
				return { ...old, clients: next };
			});
		},
	});

	const { mutateAsync: approve, isLoading: approving } = trpc.auth.approve.useMutation({
		onSuccess: () => {
			utils.auth.status.setData(undefined, (old) => (old ? { ...old, pending: [] } : old));
			void statusQuery.refetch();
		},
	});
	const { mutateAsync: deny, isLoading: denying } = trpc.auth.deny.useMutation({
		onSuccess: () => {
			utils.auth.status.setData(undefined, (old) => (old ? { ...old, pending: [] } : old));
			void statusQuery.refetch();
		},
	});
	const { mutateAsync: revoke, isLoading: revoking } = trpc.auth.revoke.useMutation({
		onSuccess: () => {
			setRevokeTarget(null);
			void statusQuery.refetch();
		},
	});
	const { mutateAsync: revokeAll, isLoading: revokingAll } = trpc.auth.revokeAll.useMutation({
		onSuccess: () => {
			utils.auth.status.setData(undefined, (old) => (old ? { ...old, clients: [] } : old));
			setRevokeTarget(null);
			void statusQuery.refetch();
		},
	});
	const { mutateAsync: revealToken, isLoading: revealing } = trpc.auth.revealToken.useMutation();

	const pending = statusQuery.data?.pending?.[0] ?? null;
	const clients = statusQuery.data?.clients ?? [];
	const authRequired = statusQuery.data?.authRequired === true;
	const busy = approving || denying || revoking || revokingAll || revealing;

	const copyToken = async (token: string) => {
		await navigator.clipboard.writeText(token);
		toast.success("Token copied");
	};

	const handleReveal = async (appId: string) => {
		try {
			const token = await revealToken({ appId });
			if (!token) {
				toast.error("No token found for this client");
				return;
			}
			await copyToken(token);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to reveal token");
		}
	};

	const handleConfirmRevoke = async () => {
		if (!revokeTarget) return;
		try {
			if (revokeTarget === "all") {
				await revokeAll();
				toast.success("All clients revoked");
			} else {
				await revoke({ appId: revokeTarget.appId });
				toast.success(`Revoked ${revokeTarget.appName}`);
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Revoke failed");
		}
	};

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						Authentication
						<Badge variant="outline">Global</Badge>
					</CardTitle>
					<CardDescription>
						Pair external apps once. Approved clients unlock gated surfaces such as the local API and Stream Deck.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<SettingsCheckbox
							configKey="api.authRequired"
							description="When enabled, API track/control endpoints require a paired client token."
							updateMessage="Auth setting updated"
						>
							Require authorization for API
						</SettingsCheckbox>
					</FieldGroup>
				</CardContent>
			</Card>

			{pending && (
				<Card className="border-primary/40">
					<CardHeader>
						<CardTitle>Authorize client</CardTitle>
						<CardDescription>Compare this code with the one shown in the requesting app, then allow access.</CardDescription>
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
							? "Authorized apps that can control playback and other unlocked surfaces."
							: "Clients can still pair now; tokens are enforced when Require authorization is on."}
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
										<div className="flex shrink-0 gap-1">
											<Button size="sm" variant="ghost" disabled={busy} onClick={() => void handleReveal(client.appId)}>
												Copy token
											</Button>
											<Button
												size="sm"
												variant="ghost"
												disabled={busy}
												onClick={() => setRevokeTarget({ appId: client.appId, appName: client.appName })}
											>
												Revoke
											</Button>
										</div>
									</Field>
								</li>
							))}
						</ul>
					)}
				</CardContent>
				<CardFooter className="flex flex-wrap gap-2">
					<Button size="sm" onClick={() => setWizardOpen(true)}>
						Create client
					</Button>
					{clients.length > 0 && (
						<Button size="sm" variant="outline" disabled={busy} onClick={() => setRevokeTarget("all")}>
							Revoke all
						</Button>
					)}
				</CardFooter>
			</Card>

			<CreateClientWizard
				open={wizardOpen}
				onOpenChange={setWizardOpen}
				onCreated={() => void statusQuery.refetch()}
				onCopyToken={copyToken}
			/>

			<RevokeConfirmDialog
				target={revokeTarget}
				busy={revoking || revokingAll}
				onOpenChange={(open) => {
					if (!open) setRevokeTarget(null);
				}}
				onConfirm={() => void handleConfirmRevoke()}
			/>
		</>
	);
}

const REVOKE_CONFIRM_WORD = "revoke";

function RevokeConfirmDialog({
	target,
	busy,
	onOpenChange,
	onConfirm,
}: {
	target: RevokeTarget | null;
	busy: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}) {
	const [confirmText, setConfirmText] = useState("");
	const [displayTarget, setDisplayTarget] = useState<RevokeTarget>("all");
	const open = target !== null;
	const confirmWord = displayTarget === "all" ? REVOKE_CONFIRM_WORD : displayTarget.appName;
	const canConfirm = confirmText.trim() === confirmWord;

	useEffect(() => {
		if (target) {
			setDisplayTarget(target);
			setConfirmText("");
		}
	}, [target]);

	const title = displayTarget === "all" ? "Revoke all clients" : `Revoke ${displayTarget.appName}`;
	const description =
		displayTarget === "all"
			? "This permanently removes every paired client. Paste tokens will stop working."
			: `This permanently removes ${displayTarget.appName} (${displayTarget.appId}). Its token will stop working.`;
	const confirmLabel = displayTarget === "all" ? "Revoke all" : "Revoke";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent showCloseButton={!busy}>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<Field>
					<FieldLabel htmlFor="revoke-confirm">
						Type <span className="font-mono text-foreground">{confirmWord}</span> to confirm
					</FieldLabel>
					<Input
						id="revoke-confirm"
						value={confirmText}
						placeholder={confirmWord}
						autoFocus
						autoComplete="off"
						disabled={busy}
						onChange={(e) => setConfirmText(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && canConfirm && !busy) onConfirm();
						}}
					/>
				</Field>
				<DialogFooter>
					<Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button variant="destructive" disabled={!canConfirm || busy} onClick={onConfirm}>
						{busy ? "Revoking…" : confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function CreateClientWizard({
	open,
	onOpenChange,
	onCreated,
	onCopyToken,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated: () => void;
	onCopyToken: (token: string) => Promise<void>;
}) {
	const [step, setStep] = useState<"form" | "token">("form");
	const [appName, setAppName] = useState("");
	const [appId, setAppId] = useState("");
	const [appVersion, setAppVersion] = useState("1.0.0");
	const [appIdTouched, setAppIdTouched] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [createdToken, setCreatedToken] = useState<string | null>(null);
	const [createdName, setCreatedName] = useState("");

	const { mutateAsync: createClient, isLoading: creating } = trpc.auth.create.useMutation();

	const suggestedId = useMemo(() => slugifyAppId(appName), [appName]);
	const effectiveAppId = appIdTouched ? appId : suggestedId || appId;

	const reset = () => {
		setStep("form");
		setAppName("");
		setAppId("");
		setAppVersion("1.0.0");
		setAppIdTouched(false);
		setError(null);
		setCreatedToken(null);
		setCreatedName("");
	};

	const handleOpenChange = (next: boolean) => {
		if (!next) reset();
		onOpenChange(next);
	};

	const handleCreate = async () => {
		setError(null);
		try {
			const result = await createClient({
				appId: effectiveAppId,
				appName,
				appVersion: appVersion.trim() || "1.0.0",
			});
			setCreatedToken(result.token);
			setCreatedName(result.client.appName);
			setStep("token");
			onCreated();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create client");
		}
	};

	return (
		<Sheet open={open} onOpenChange={handleOpenChange}>
			<SheetContent side="right" className="gap-0">
				<SheetHeader>
					<SheetTitle>{step === "form" ? "Create client" : "Client token"}</SheetTitle>
					<SheetDescription>
						{step === "form"
							? "Manually issue a token for apps that cannot complete pairing (paste into Stream Deck, scripts, …)."
							: "Copy this token now and paste it into the client. You can also copy it later from the clients list."}
					</SheetDescription>
				</SheetHeader>

				<div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
					{step === "form" ? (
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="client-app-name">Display name</FieldLabel>
								<Input
									id="client-app-name"
									value={appName}
									placeholder="My Script"
									onChange={(e) => setAppName(e.target.value)}
									autoFocus
								/>
								<FieldDescription>Shown in the paired clients list.</FieldDescription>
							</Field>
							<Field>
								<FieldLabel htmlFor="client-app-id">App ID</FieldLabel>
								<Input
									id="client-app-id"
									value={effectiveAppId}
									placeholder="myscript"
									onChange={(e) => {
										setAppIdTouched(true);
										setAppId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 32));
									}}
								/>
								<FieldDescription>2–32 lowercase letters/numbers. Reusing an ID replaces that client.</FieldDescription>
							</Field>
							<Field>
								<FieldLabel htmlFor="client-app-version">Version</FieldLabel>
								<Input
									id="client-app-version"
									value={appVersion}
									placeholder="1.0.0"
									onChange={(e) => setAppVersion(e.target.value)}
								/>
							</Field>
							{error && <p className="text-xs text-destructive">{error}</p>}
						</FieldGroup>
					) : (
						<div className="flex flex-col gap-3">
							<p className="text-sm text-muted-foreground">
								Token for <span className="font-medium text-foreground">{createdName}</span>
							</p>
							<div className="rounded-lg bg-muted p-3">
								<code className="block max-h-40 overflow-auto break-all font-mono text-[11px] leading-relaxed">{createdToken}</code>
							</div>
						</div>
					)}
				</div>

				<SheetFooter>
					{step === "form" ? (
						<>
							<Button variant="outline" onClick={() => handleOpenChange(false)}>
								Cancel
							</Button>
							<Button
								disabled={creating || effectiveAppId.length < 2 || appName.trim().length < 2}
								onClick={() => void handleCreate()}
							>
								{creating ? "Creating…" : "Create & show token"}
							</Button>
						</>
					) : (
						<>
							<Button variant="outline" disabled={!createdToken} onClick={() => createdToken && void onCopyToken(createdToken)}>
								Copy token
							</Button>
							<Button onClick={() => handleOpenChange(false)}>Done</Button>
						</>
					)}
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
