import { createFileRoute } from "@tanstack/react-router";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { SettingsGroup } from "@/components/settings-group";
import { useSettingsState } from "@/hooks/use-settings";

export const Route = createFileRoute("/_settings/discord")({
	component: DiscordSettingsPage,
});

function DiscordSettingsPage() {
	const [discordEnabled] = useSettingsState<boolean>("discord.enabled", false);

	return (
		<SettingsGroup
			title="Discord"
			description="Manage Discord Rich Presence for what you are listening to."
			footer={
				<a href="https://discord.com/rich-presence" target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-foreground hover:underline">
					Learn more about Rich Presence
				</a>
			}
		>
			<SettingsCheckbox configKey="discord.enabled">Enable Discord</SettingsCheckbox>
			<SettingsCheckbox configKey="discord.buttons" nested disabled={!discordEnabled}>
				Show Discord buttons
			</SettingsCheckbox>
		</SettingsGroup>
	);
}
