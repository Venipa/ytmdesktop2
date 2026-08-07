import { createFileRoute } from "@tanstack/react-router";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { SettingsInput } from "@/components/settings-input";
import { SettingsSelect } from "@/components/settings-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { useSettingsState } from "@/hooks/use-settings";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/_settings/appearance/themes")({
	component: ThemesSettingsPage,
});

function ThemesSettingsPage() {
	const [enabled, , { isPending: enabledPending }] = useSettingsState("themes.enabled", false);
	const [selected, , { isPending: selectedPending }] = useSettingsState("themes.selected", "default");
	const [customFile, , { isPending: pathPending }] = useSettingsState("themes.customFile", "");
	const { data: themes } = trpc.themes.list.useQuery();
	const { mutateAsync: reload } = trpc.themes.reload.useMutation();
	const { mutateAsync: openFile } = trpc.app.openFile.useMutation();

	const isCustom = selected === "custom";
	const themeOptions =
		themes?.map((t) => ({ value: t.id, label: t.name })) ??
		[
			{ value: "default", label: "Default" },
			{ value: "custom", label: "Custom" },
		];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Themes</CardTitle>
				<CardDescription>Pick a bundled theme or inject your own SCSS/CSS into YouTube Music.</CardDescription>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<SettingsCheckbox configKey="themes.enabled">Enable Themes</SettingsCheckbox>
					<SettingsCheckbox configKey="themes.thumbnailBackground">Enable Thumbnail Background</SettingsCheckbox>
					{enabled && !enabledPending && (
						<>
							<SettingsSelect configKey="themes.selected" label="Theme" defaultValue="default" options={themeOptions} />
							{isCustom && !selectedPending && (
								<>
									<SettingsCheckbox configKey="themes.watching" description="Recompile and inject when the file changes on disk.">
										Update on Changes
									</SettingsCheckbox>
									<SettingsInput
										configKey="themes.customFile"
										type="file"
										accept=".scss,.sass,.css"
										label="Custom Theme File"
										hint={
											<div className="mt-2 flex justify-end gap-2">
												<Button type="button" size="sm" variant="outline" disabled={pathPending} onClick={() => void reload()}>
													Reload
												</Button>
												<Button
													type="button"
													size="sm"
													variant="outline"
													disabled={pathPending || !customFile}
													onClick={() => {
														if (customFile) void openFile(customFile);
													}}
												>
													Open File
												</Button>
											</div>
										}
									/>
								</>
							)}
							{!isCustom && (
								<div className="flex justify-end">
									<Button type="button" size="sm" variant="outline" onClick={() => void reload()}>
										Reload
									</Button>
								</div>
							)}
						</>
					)}
				</FieldGroup>
			</CardContent>
		</Card>
	);
}
