import { createFileRoute } from "@tanstack/react-router";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { SettingsInput } from "@/components/settings-input";
import { Button } from "@/components/ui/button";
import { useSetting } from "@/hooks/use-settings";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/_settings/custom-css")({
	component: CustomCssSettingsPage,
});

function CustomCssSettingsPage() {
	const [enabled] = useSetting<boolean>("customcss.enabled");
	const [scssPath] = useSetting<string>("customcss.scssFile", "");
	const reloadCss = trpc.customCss.reload.useMutation();
	const openFile = trpc.app.openFile.useMutation();

	return (
		<div className="mt-4 flex flex-col gap-4">
			<div className="flex flex-col gap-4 px-3">
				<SettingsCheckbox configKey="customcss.enabled">Enable Custom CSS</SettingsCheckbox>
				<SettingsCheckbox configKey="customcss.watching">Update on Changes</SettingsCheckbox>
				<SettingsCheckbox configKey="customcss.thumbnailBackground">Enable Thumbnail Background</SettingsCheckbox>
				{enabled && (
					<div className="flex flex-col gap-4">
						<SettingsInput
							configKey="customcss.scssFile"
							type="file"
							accept=".scss,.sass"
							label="SCSS File"
							hint={
								<div className="mt-2 flex justify-end gap-2">
									<Button type="button" size="sm" variant="outline" onClick={() => reloadCss.mutate()}>
										Reload
									</Button>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() => {
											if (scssPath) openFile.mutate(scssPath);
										}}
									>
										Open CSS File
									</Button>
								</div>
							}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
