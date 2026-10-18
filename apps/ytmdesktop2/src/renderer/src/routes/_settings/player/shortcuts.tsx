import {
	acceleratorDisplayParts,
	acceleratorFromKeyboardEvent,
	type ShortcutPlatform,
} from "@shared/shortcuts/accelerators";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useSettingsState } from "@/hooks/use-settings";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/_settings/player/shortcuts")({
	component: PlayerShortcutsPage,
});

function platform(): ShortcutPlatform {
	const value = window.app.platform;
	if (value === "darwin" || value === "win32") return value;
	return "linux";
}

function readBindKey(event: React.KeyboardEvent, os: ShortcutPlatform): "cancel" | "clear" | { accelerator: string } | null {
	if (event.key === "Escape") return "cancel";
	if ((event.key === "Backspace" || event.key === "Delete") && !event.ctrlKey && !event.altKey && !event.metaKey) {
		return "clear";
	}
	const accelerator = acceleratorFromKeyboardEvent(event, os);
	return accelerator ? { accelerator } : null;
}

function PlayerShortcutsPage() {
	const os = platform();
	const [enabled] = useSettingsState("shortcuts.enabled", true);
	const utils = trpc.useUtils();
	const { data: rows = [] } = trpc.shortcut.list.useQuery();
	const setBind = trpc.shortcut.set.useMutation({
		onSuccess: () => void utils.shortcut.list.invalidate(),
	});
	const reset = trpc.shortcut.reset.useMutation({
		onSuccess: () => void utils.shortcut.list.invalidate(),
	});
	const capture = trpc.shortcut.capture.useMutation();
	const [capturingId, setCapturingId] = useState<string | null>(null);
	const [errorById, setErrorById] = useState<Record<string, string>>({});
	const [resetAllOpen, setResetAllOpen] = useState(false);
	const capturing = capturingId !== null;

	useEffect(() => {
		capture.mutate({ active: capturing });
		return () => {
			capture.mutate({ active: false });
		};
	}, [capturing]);

	const applySet = (id: string, accelerator: string | null) => {
		void setBind.mutateAsync({ id, accelerator }).then((result) => {
			if (!result.ok) {
				setErrorById((prev) => ({ ...prev, [id]: result.reason }));
				return;
			}
			setErrorById((prev) => ({ ...prev, [id]: "" }));
			setCapturingId(null);
		});
	};

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Global shortcuts</CardTitle>
					<CardDescription>OS-wide media keybinds. Rejected if the system or another action already uses them.</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<SettingsCheckbox configKey="shortcuts.enabled" defaultValue={true} description="When off, none of these fire.">
							Enable global shortcuts
						</SettingsCheckbox>
					</FieldGroup>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-start justify-between gap-4">
					<div>
						<CardTitle>Keybinds</CardTitle>
						<CardDescription>Click a bind, then press a combo. Escape cancels. Backspace clears.</CardDescription>
					</div>
					<Button variant="ghost" size="sm" disabled={!enabled || reset.isLoading} onClick={() => setResetAllOpen(true)}>
						Reset all
					</Button>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						{rows.map((row) => {
							const error = errorById[row.id];
							const rowCapturing = capturingId === row.id;
							const parts = row.accelerator ? acceleratorDisplayParts(row.accelerator, os) : [];
							return (
								<Field key={row.id} orientation="horizontal" data-invalid={error ? true : undefined}>
									<FieldContent>
										<FieldTitle>{row.label}</FieldTitle>
										{error ? <FieldDescription>{error}</FieldDescription> : null}
									</FieldContent>
									<button
										type="button"
										disabled={!enabled}
										aria-label={`${row.label} shortcut${parts.length ? `: ${parts.join(" + ")}` : ""}`}
										className="inline-flex h-7 min-w-36 items-center justify-center rounded-md border border-border bg-muted/40 px-2.5 hover:bg-muted disabled:opacity-50"
										onBlur={() => setCapturingId((id) => (id === row.id ? null : id))}
										onClick={() => {
											setErrorById((prev) => ({ ...prev, [row.id]: "" }));
											setCapturingId(row.id);
										}}
										onKeyDown={(event) => {
											if (!rowCapturing) return;
											event.preventDefault();
											event.stopPropagation();
											const next = readBindKey(event, os);
											if (next === "cancel") {
												setCapturingId(null);
												return;
											}
											if (next === "clear") {
												applySet(row.id, null);
												return;
											}
											if (next) applySet(row.id, next.accelerator);
										}}
									>
										{rowCapturing ? (
											<span className="text-xs text-muted-foreground">Press keys...</span>
										) : parts.length ? (
											<KbdGroup>
												{parts.map((part, index) => (
													<Kbd key={`${part}-${index}`}>{part}</Kbd>
												))}
											</KbdGroup>
										) : (
											<span className="text-xs text-muted-foreground">Unbound</span>
										)}
									</button>
									<Button
										variant="ghost"
										size="xs"
										disabled={!enabled || row.source === "default" || reset.isLoading}
										onClick={() => reset.mutate({ id: row.id })}
									>
										Reset
									</Button>
								</Field>
							);
						})}
					</FieldGroup>
				</CardContent>
			</Card>

			<ConfirmDialog
				open={resetAllOpen}
				onOpenChange={setResetAllOpen}
				title="Reset all shortcuts?"
				description="Restore default binds for previous, next, and play/pause. Extra actions become unbound."
				confirmLabel="Reset all"
				pending={reset.isLoading}
				onConfirm={() => reset.mutate({})}
			/>
		</>
	);
}
