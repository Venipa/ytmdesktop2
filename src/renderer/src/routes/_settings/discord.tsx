import { createFileRoute } from "@tanstack/react-router";
import { SettingsCheckbox } from "@/components/settings-checkbox";

export const Route = createFileRoute("/_settings/discord")({
	component: DiscordSettingsPage,
});

function DiscordSettingsPage() {
	return (
		<div className="flex flex-col gap-4">
			<div className="mt-4 bg-white/5 shadow sm:rounded-lg">
				<div className="px-4 py-5 sm:p-6">
					<h3 className="text-lg font-medium leading-6 text-foreground">Discord</h3>
					<div className="mt-2 max-w-xl text-sm text-muted-foreground">
						<p>Manage your Discord Rich Presence</p>
					</div>
					<div className="mt-3 text-sm">
						<a href="https://discord.com/rich-presence" target="_blank" rel="noreferrer" className="font-medium text-indigo-400 hover:text-indigo-300">
							Learn more about Discord's Rich Presence <span aria-hidden="true">&rarr;</span>
						</a>
					</div>
				</div>
			</div>
			<div className="mt-4 flex flex-col gap-4 px-3">
				<SettingsCheckbox configKey="discord.enabled">Enable Discord</SettingsCheckbox>
				<SettingsCheckbox configKey="discord.buttons">Show Discord Buttons</SettingsCheckbox>
			</div>
		</div>
	);
}
