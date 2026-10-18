import { acceleratorFromKeyboardEvent, type ShortcutPlatform } from "@shared/shortcuts/accelerators";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
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

function PlayerShortcutsPage() {
	const [enabled] = useSettingsState("shortcuts.enabled", true);
	const utils = trpc.useUtils();
	const { data: rows = [] } = trpc.shortcut.list.useQuery();
	const setBind = trpc.shortcut.set.useMutation({
		onSuccess: () => void utils.shortcut.list.invalidate(),
	});
	const reset = trpc.shortcut.reset.useMutation({
		onSuccess: () => void utils.shortcut.list.invalidate(),
	});
	const [capturingId, setCapturingId] = useState<string | null>(null);
	const [errorById, setErrorById] = useState<Record<string, string>>({});
	const capture = trpc.shortcut.capture.useMutation();
	const capturing = capturingId !== null;

	useEffect(() => {
		capture.mutate({ active: capturing });
	}, [capturing]);

	useEffect(() => {
		return () => {
			capture.mutate({ active: false });
		};
	}, []);

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
					<Button variant="ghost" size="sm" disabled={!enabled || reset.isLoading} onClick={() => reset.mutate({})}>
						Reset all
					</Button>
				</CardHeader>
				<CardContent className="flex flex-col gap-2">
					{rows.map((row) => {
						const error = errorById[row.id];
						const capturing = capturingId === row.id;
						return (
							<div key={row.id} className="flex flex-col gap-1 border-b border-border/60 py-2 last:border-0">
								<div className="flex items-center gap-2">
									<div className="min-w-0 flex-1">
										<div className="text-sm font-medium">{row.label}</div>
										{error ? <p className="text-xs text-destructive">{error}</p> : null}
									</div>
									<button
										type="button"
										disabled={!enabled}
										aria-label={`${row.label} shortcut`}
										className="min-w-36 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-medium tabular-nums hover:bg-muted disabled:opacity-50"
										onBlur={() => setCapturingId((id) => (id === row.id ? null : id))}
										onClick={() => {
											setErrorById((prev) => ({ ...prev, [row.id]: "" }));
											setCapturingId(row.id);
										}}
										onKeyDown={(event) => {
											if (!capturing) return;
											event.preventDefault();
											event.stopPropagation();
											if (event.key === "Escape") {
												setCapturingId(null);
												return;
											}
											if (event.key === "Backspace" || event.key === "Delete") {
												if (!event.ctrlKey && !event.altKey && !event.metaKey) {
													void setBind.mutateAsync({ id: row.id, accelerator: null }).then((result) => {
														if (!result.ok) setErrorById((prev) => ({ ...prev, [row.id]: result.reason }));
														else setCapturingId(null);
													});
												}
												return;
											}
											const accel = acceleratorFromKeyboardEvent(event, platform());
											if (!accel) return;
											void setBind.mutateAsync({ id: row.id, accelerator: accel }).then((result) => {
												if (!result.ok) setErrorById((prev) => ({ ...prev, [row.id]: result.reason }));
												else {
													setErrorById((prev) => ({ ...prev, [row.id]: "" }));
													setCapturingId(null);
												}
											});
										}}
									>
										{capturing ? "Press keys..." : row.accelerator ?? "Unbound"}
									</button>
									<Button
										variant="ghost"
										size="xs"
										disabled={!enabled || row.source === "default" || reset.isLoading}
										onClick={() => reset.mutate({ id: row.id })}
									>
										Reset
									</Button>
								</div>
							</div>
						);
					})}
				</CardContent>
			</Card>
		</>
	);
}
