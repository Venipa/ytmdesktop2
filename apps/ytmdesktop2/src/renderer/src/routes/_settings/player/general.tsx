import { createFileRoute } from "@tanstack/react-router";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { SettingsGroup } from "@/components/settings-group";
import { SettingsSelect } from "@/components/settings-select";
import { Badge } from "@/components/ui/badge";
import { useSettingsState } from "@/hooks/use-settings";

export const Route = createFileRoute("/_settings/player/general")({
	component: PlayerGeneralSettingsPage,
});

function PlayerGeneralSettingsPage() {
	const [resEnabled, , { isPending: resPending }] = useSettingsState("player.res.enabled", false);

	return (
		<>
			<SettingsGroup title="Playback">
				<SettingsCheckbox
					configKey="player.skipDisliked"
					description={
						<>
							<Badge variant="outline" className="mr-1.5">Experimental</Badge>
							Automatically skip tracks you disliked.
						</>
					}
				>
					Skip disliked songs
				</SettingsCheckbox>
				<SettingsCheckbox
					configKey="player.queueContinue"
					defaultValue={true}
					description="Load the next batch of a long playlist or Liked Songs before Up Next runs out."
				>
					Continue long queues
				</SettingsCheckbox>
				<SettingsCheckbox
					configKey="volumeRatio.enabled"
					description="Use an exponential volume curve for finer control than the default linear slider."
				>
					Exponential volume ratio
				</SettingsCheckbox>
				<SettingsCheckbox configKey="app.enableTaskbarProgress" description="Show playback progress on the taskbar.">
					Enable taskbar progress
				</SettingsCheckbox>
				<SettingsCheckbox
					configKey="player.chromecastEnabled"
					description={
						<>
							<Badge variant="outline" className="mr-1.5">Experimental</Badge>
							Show YouTube Music Cast and talk to devices on this LAN. Restart required. Firewall must allow mDNS.
						</>
					}
				>
					Enable Chromecast
				</SettingsCheckbox>
			</SettingsGroup>

			<SettingsGroup title="Shared links">
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
			</SettingsGroup>

			<SettingsGroup title="Video">
				<SettingsCheckbox configKey="player.res.enabled">Customize player video settings</SettingsCheckbox>
				<SettingsSelect
					configKey="player.res.prefer"
					label="Preferred video resolution"
					nested
					disabled={!resEnabled || resPending}
					options={[
						{ value: "hd2160", label: "2160P UHD / 4K" },
						{ value: "hd1440", label: "1440P QHD" },
						{ value: "hd1080", label: "1080P FHD" },
						{ value: "hd720", label: "720P HD" },
						{ value: "auto", label: "Default" },
					]}
				/>
			</SettingsGroup>
		</>
	);
}
