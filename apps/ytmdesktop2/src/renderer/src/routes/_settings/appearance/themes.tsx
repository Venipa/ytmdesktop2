import { createFileRoute } from "@tanstack/react-router";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { SettingsInput } from "@/components/settings-input";
import { SettingsSelect } from "@/components/settings-select";
import { Button } from "@/components/ui/button";
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
	const themeLocked = !enabled || enabledPending;
	const themeOptions =
		themes?.map((t) => ({ value: t.id, label: t.name })) ??
		[
			{ value: "default", label: "Default" },
			{ value: "custom", label: "Custom" },
		];

	return (
		<SettingsGroup title="Themes" description="Pick a bundled theme or inject your own SCSS/CSS into YouTube Music.">
			<SettingsCheckbox configKey="themes.enabled">Enable themes</SettingsCheckbox>
			<SettingsSelect
				configKey="themes.selected"
				label="Theme"
				defaultValue="default"
				nested
				disabled={themeLocked}
				options={themeOptions}
			/>
			{isCustom && !selectedPending && (
				<>
					<SettingsCheckbox
						configKey="themes.watching"
						nested
						disabled={themeLocked}
						description="Recompile and inject when the file changes on disk."
					>
						Update on changes
					</SettingsCheckbox>
					<SettingsInput
						configKey="themes.customFile"
						type="file"
						accept=".scss,.sass,.css"
						label="Custom theme file"
						nested
						disabled={themeLocked}
						hint={
							<div className="flex justify-end gap-2">
								<Button
									type="button"
									size="sm"
									variant="outline"
									disabled={themeLocked || pathPending || !customFile}
									onClick={() => {
										if (customFile) void openFile(customFile);
									}}
								>
									Open file
								</Button>
							</div>
						}
					/>
				</>
			)}
			<SettingsRow label="Reload theme" description="Recompile and inject the selected theme now." nested disabled={themeLocked}>
				<Button type="button" size="sm" variant="outline" disabled={themeLocked || pathPending} onClick={() => void reload()}>
					Reload
				</Button>
			</SettingsRow>
			<SettingsCheckbox configKey="themes.thumbnailBackground">Enable thumbnail background</SettingsCheckbox>
			<SettingsCheckbox configKey="themes.blur" description="Glass blur on player, bar, and dialogs. Turn off for better performance.">
				Enable blur
			</SettingsCheckbox>
		</SettingsGroup>
	);
}
