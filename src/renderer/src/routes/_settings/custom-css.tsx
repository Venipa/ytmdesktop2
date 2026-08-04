import { createFileRoute } from "@tanstack/react-router";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { SettingsInput } from "@/components/settings-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { useSettingsState } from "@/hooks/use-settings";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/_settings/custom-css")({
	component: CustomCssSettingsPage,
});

function CustomCssSettingsPage() {
	const [enabled, , { isPending: cssPending }] = useSettingsState("customcss.enabled", false);
	const [scssPath, , { isPending: pathPending }] = useSettingsState("customcss.scssFile", "");
	const { mutateAsync: reload } = trpc.customCss.reload.useMutation();
	const { mutateAsync: openFile } = trpc.app.openFile.useMutation();

	return (
		<Card>
			<CardHeader>
				<CardTitle>Custom CSS</CardTitle>
				<CardDescription>Inject and live-reload custom styles for YouTube Music.</CardDescription>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<SettingsCheckbox configKey="customcss.enabled">Enable Custom CSS</SettingsCheckbox>
					<SettingsCheckbox configKey="customcss.watching">Update on Changes</SettingsCheckbox>
					<SettingsCheckbox configKey="customcss.thumbnailBackground">Enable Thumbnail Background</SettingsCheckbox>
					{enabled && !cssPending && (
						<SettingsInput
							configKey="customcss.scssFile"
							type="file"
							accept=".scss,.sass"
							label="SCSS File"
							hint={
								<div className="mt-2 flex justify-end gap-2">
									<Button type="button" size="sm" variant="outline" disabled={pathPending} onClick={() => void reload()}>
										Reload
									</Button>
									<Button
										type="button"
										size="sm"
										variant="outline"
										disabled={pathPending || !scssPath}
										onClick={() => {
											if (scssPath) void openFile(scssPath);
										}}
									>
										Open CSS File
									</Button>
								</div>
							}
						/>
					)}
				</FieldGroup>
			</CardContent>
		</Card>
	);
}
