import { createFileRoute } from "@tanstack/react-router";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { SettingsSelect } from "@/components/settings-select";
import { useSetting } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_settings/player")({
	component: PlayerSettingsPage,
});

function PlayerSettingsPage() {
	const [resEnabled] = useSetting<boolean>("player.res.enabled");

	return (
		<div className="flex flex-col gap-4">
			<div className="mt-4 bg-white/5 shadow sm:rounded-lg">
				<div className="px-4 py-5 sm:p-6">
					<h3 className="text-lg font-medium leading-6 text-foreground">Player Settings</h3>
					<div className="mt-2 max-w-xl text-sm text-muted-foreground">
						<p>Manage your player settings here</p>
					</div>
				</div>
			</div>
			<div className="mt-4 flex flex-col gap-4 px-3">
				<SettingsCheckbox configKey="player.skipDisliked" className="group">
					<div className="flex flex-col">
						<div>Skip disliked Songs</div>
						<div className="select-none text-xs font-medium text-red-500 uppercase opacity-80 group-hover:opacity-100">Experimental</div>
					</div>
				</SettingsCheckbox>
				<SettingsCheckbox configKey="volumeRatio.enabled" className="group">
					<div className="flex flex-col">
						<div>Implement new Volume Ratio Handler</div>
						<div className="mt-2 max-w-xl text-sm text-muted-foreground">
							<p>Use an exponential volume slider for YouTube Music to enhance control and avoid the ineffectiveness of the default linear slider.</p>
						</div>
					</div>
				</SettingsCheckbox>
				<div className={cn("flex flex-col gap-4 rounded-lg border -mx-3 px-3 py-3", resEnabled ? "border-gray-500" : "border-gray-500/0")}>
					<SettingsCheckbox configKey="player.res.enabled" className="group">
						<div className="flex flex-col">
							<div>Player Video Settings</div>
							<div className="select-none text-xs font-medium uppercase opacity-80 group-hover:opacity-100">Customize player video settings</div>
						</div>
					</SettingsCheckbox>
					{resEnabled && (
						<SettingsSelect
							configKey="player.res.prefer"
							label="Preferred Video Resolution (if available)"
							options={[
								{ value: "hd2160", label: "2160P UHD / 4K" },
								{ value: "hd1440", label: "1440P QHD" },
								{ value: "hd1080", label: "1080P FHD" },
								{ value: "hd720", label: "720P HD" },
								{ value: "auto", label: "Default" },
							]}
						/>
					)}
				</div>
				<SettingsCheckbox configKey="app.enableTaskbarProgress">
					<div className="flex flex-col">
						<span>Enable Taskbar Progress</span>
						<span className="opacity-80">(shows a progress bar in the taskbar when playing music.)</span>
					</div>
				</SettingsCheckbox>
			</div>
		</div>
	);
}
