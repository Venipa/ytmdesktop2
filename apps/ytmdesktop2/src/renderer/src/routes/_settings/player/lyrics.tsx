import { createFileRoute } from "@tanstack/react-router";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";

export const Route = createFileRoute("/_settings/player/lyrics")({
	component: LyricsSettingsPage,
});

function LyricsSettingsPage() {
	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Synced lyrics</CardTitle>
					<CardDescription>Replace the YouTube Music Lyrics tab with timed lyrics from LRCLib.</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<SettingsCheckbox
							configKey="lyrics.enabled"
							description="When enabled, open the Lyrics tab in the player to see synced lines. Click a line to seek."
						>
							Enable synced lyrics
						</SettingsCheckbox>
						<SettingsCheckbox
							configKey="lyrics.showEvenIfInexact"
							defaultValue={true}
							description="Show lyrics when the match is approximate (title/artist close but not exact)."
						>
							Allow approximate matches
						</SettingsCheckbox>
						<SettingsCheckbox
							configKey="lyrics.showTimeCodes"
							description="Prefix each line with its timestamp."
						>
							Show time codes
						</SettingsCheckbox>
						<SettingsCheckbox
							configKey="lyrics.showProgressBar"
							defaultValue={true}
							description="Fill the active lyric row with a muted translucent background as it plays."
						>
							Show line progress
						</SettingsCheckbox>
					</FieldGroup>
				</CardContent>
				<CardFooter>
					<a href="https://lrclib.net" target="_blank" rel="noreferrer" className="text-xs text-primary underline-offset-4 hover:underline">
						Lyrics provided by LRCLib
					</a>
				</CardFooter>
			</Card>
		</>
	);
}
