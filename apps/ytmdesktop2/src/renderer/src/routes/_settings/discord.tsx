import { createFileRoute } from "@tanstack/react-router";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";

export const Route = createFileRoute("/_settings/discord")({
	component: DiscordSettingsPage,
});

function DiscordSettingsPage() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Discord</CardTitle>
				<CardDescription>Manage Discord Rich Presence for what you are listening to.</CardDescription>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<SettingsCheckbox configKey="discord.enabled">Enable Discord</SettingsCheckbox>
					<SettingsCheckbox configKey="discord.buttons">Show Discord Buttons</SettingsCheckbox>
				</FieldGroup>
			</CardContent>
			<CardFooter>
				<a href="https://discord.com/rich-presence" target="_blank" rel="noreferrer" className="text-xs text-primary underline-offset-4 hover:underline">
					Learn more about Rich Presence
				</a>
			</CardFooter>
		</Card>
	);
}
