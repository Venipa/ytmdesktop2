import { createFileRoute } from "@tanstack/react-router";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { SettingsSelect } from "@/components/settings-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { useSettingsState } from "@/hooks/use-settings";

export const Route = createFileRoute("/_settings/player/general")({
	component: PlayerGeneralSettingsPage,
});

function PlayerGeneralSettingsPage() {
	const [resEnabled, , { isPending: resPending }] = useSettingsState("player.res.enabled", false);

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Player</CardTitle>
					<CardDescription>Playback behavior and video preferences.</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<SettingsCheckbox
							configKey="player.skipDisliked"
							description={
								<span className="inline-flex items-center gap-2">
									Automatically skip tracks you disliked.
									<Badge variant="outline">Experimental</Badge>
								</span>
							}
						>
							Skip disliked songs
						</SettingsCheckbox>
						<SettingsCheckbox
							configKey="volumeRatio.enabled"
							description="Use an exponential volume curve for finer control than the default linear slider."
						>
							Exponential volume ratio
						</SettingsCheckbox>
						<SettingsCheckbox configKey="app.enableTaskbarProgress" description="Show playback progress on the taskbar.">
							Enable Taskbar Progress
						</SettingsCheckbox>
					</FieldGroup>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Shared links</CardTitle>
					<CardDescription>How ytmd:// links open and how YouTube Music share URLs are rewritten.</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<SettingsSelect
							configKey="player.deepLinkOpen"
							defaultValue="ask"
							label="When opening a shared link"
							description="How ytmd:// share links behave when the app receives them."
							options={[
								{
									value: "ask",
									label: "Ask first",
									description: "Choose play now, add to queue, or cancel",
								},
								{
									value: "play",
									label: "Play immediately",
									description: "Start the track without a confirmation dialog",
								},
							]}
						/>
						<SettingsCheckbox
							configKey="player.replaceShareLinks"
							defaultValue={true}
							description="Rewrite the share dialog URL to ytmd:// so Copy opens this app."
						>
							Replace share links with ytmd://
						</SettingsCheckbox>
					</FieldGroup>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Video</CardTitle>
					<CardDescription>Preferred resolution when available.</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<SettingsCheckbox configKey="player.res.enabled">Customize player video settings</SettingsCheckbox>
						{resEnabled && !resPending && (
							<SettingsSelect
								configKey="player.res.prefer"
								label="Preferred Video Resolution"
								options={[
									{ value: "hd2160", label: "2160P UHD / 4K" },
									{ value: "hd1440", label: "1440P QHD" },
									{ value: "hd1080", label: "1080P FHD" },
									{ value: "hd720", label: "720P HD" },
									{ value: "auto", label: "Default" },
								]}
							/>
						)}
					</FieldGroup>
				</CardContent>
			</Card>
		</>
	);
}
