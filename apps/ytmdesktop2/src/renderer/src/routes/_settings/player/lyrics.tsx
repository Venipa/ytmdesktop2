import { DEFAULT_LYRICS_OVERLAY_SETTINGS, LYRICS_OVERLAY_FONT_SIZE, LYRICS_OVERLAY_OUTLINE_WIDTH } from "@shared/lyrics/overlay";
import { createFileRoute } from "@tanstack/react-router";
import { LyricsProvidersOrder } from "@/components/lyrics-providers-order";
import { SettingsCheckbox } from "@/components/settings-checkbox";
import { SettingsColor } from "@/components/settings-color";
import { SettingsInput } from "@/components/settings-input";
import { SettingsSelect, type SettingsSelectOption } from "@/components/settings-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { useSettingsState } from "@/hooks/use-settings";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/_settings/player/lyrics")({
	component: LyricsSettingsPage,
});

const LINE_STYLE_OPTIONS: SettingsSelectOption[] = [
	{
		value: "highlight",
		label: "Highlight only",
		description: "Light the current line up. Word-synced lyrics still step word by word; no extra indicator.",
	},
	{
		value: "fill",
		label: "Text fill",
		description:
			"Word-synced lyrics: each word sweeps to white as it's sung. Songs with line timing only fall back to Highlight only.",
	},
	{
		value: "bar",
		label: "Progress bar",
		description: "Songs with line timing only: a row background advances across the line at a constant rate.",
	},
];

const OVERLAY_ALIGN_OPTIONS: SettingsSelectOption[] = [
	{ value: "center", label: "Center" },
	{ value: "left", label: "Left" },
	{ value: "right", label: "Right" },
];

function DesktopLyricsCard({ lyricsEnabled }: { lyricsEnabled: boolean }) {
	const [overlayEnabled] = useSettingsState<boolean>("lyrics.overlay.enabled", DEFAULT_LYRICS_OVERLAY_SETTINGS.enabled);
	const [lineStyle] = useSettingsState<string>("lyrics.overlay.lineStyle", DEFAULT_LYRICS_OVERLAY_SETTINGS.lineStyle);
	const [showNextLine] = useSettingsState<boolean>("lyrics.overlay.showNextLine", DEFAULT_LYRICS_OVERLAY_SETTINGS.showNextLine);
	const [textOutline] = useSettingsState<boolean>("lyrics.overlay.textOutline", DEFAULT_LYRICS_OVERLAY_SETTINGS.textOutline);
	const [textShadow] = useSettingsState<boolean>("lyrics.overlay.textShadow", DEFAULT_LYRICS_OVERLAY_SETTINGS.textShadow);
	const { mutate: resetPosition } = trpc.lyrics.resetOverlayPosition.useMutation();
	const controlsDisabled = !lyricsEnabled || !overlayEnabled;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Desktop lyrics</CardTitle>
				<CardDescription>
					A transparent always-on-top window that shows the current line over any app. Drag it anywhere and pull
					its edges to resize, then lock it so clicks and keys pass straight through to whatever is underneath.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<SettingsCheckbox
						configKey="lyrics.overlay.enabled"
						defaultValue={DEFAULT_LYRICS_OVERLAY_SETTINGS.enabled}
						disabled={!lyricsEnabled}
						description="Open the floating lyrics window. Also available from the tray icon menu."
					>
						Show desktop lyrics
					</SettingsCheckbox>
					<SettingsCheckbox
						configKey="lyrics.overlay.locked"
						defaultValue={DEFAULT_LYRICS_OVERLAY_SETTINGS.locked}
						disabled={controlsDisabled}
						description="Click-through and never focused: the mouse and keyboard ignore the window. Unlock here or from the tray menu to move it again."
					>
						Lock position (click-through)
					</SettingsCheckbox>
					<SettingsSelect
						configKey="lyrics.overlay.lineStyle"
						defaultValue={DEFAULT_LYRICS_OVERLAY_SETTINGS.lineStyle}
						disabled={controlsDisabled}
						label="Highlight style"
						description="Same three styles as the in-app Lyrics tab. Text fill needs word/syllable timing; line-only songs fall back to Highlight, or the constant-rate bar."
						options={LINE_STYLE_OPTIONS}
					/>
					<div className="grid gap-4 sm:grid-cols-3">
						<SettingsInput
							configKey="lyrics.overlay.fontSize"
							type="number"
							min={LYRICS_OVERLAY_FONT_SIZE.min}
							max={LYRICS_OVERLAY_FONT_SIZE.max}
							defaultValue={DEFAULT_LYRICS_OVERLAY_SETTINGS.fontSize}
							disabled={controlsDisabled}
							label="Font size (px)"
						/>
						<SettingsColor
							configKey="lyrics.overlay.textColor"
							defaultValue={DEFAULT_LYRICS_OVERLAY_SETTINGS.textColor}
							disabled={controlsDisabled}
							withOpacity={false}
							label="Text colour"
						/>
						<SettingsColor
							configKey="lyrics.overlay.accentColor"
							defaultValue={DEFAULT_LYRICS_OVERLAY_SETTINGS.accentColor}
							disabled={controlsDisabled}
							withOpacity={false}
							label="Sung / accent colour"
							hint="Fill sweep, stepped words, and the whole line in Highlight mode (or Text fill on line-only songs)."
						/>
					</div>
					<SettingsSelect
						configKey="lyrics.overlay.align"
						defaultValue={DEFAULT_LYRICS_OVERLAY_SETTINGS.align}
						disabled={controlsDisabled}
						label="Alignment"
						options={OVERLAY_ALIGN_OPTIONS}
					/>
					<SettingsCheckbox
						configKey="lyrics.overlay.showNextLine"
						defaultValue={DEFAULT_LYRICS_OVERLAY_SETTINGS.showNextLine}
						disabled={controlsDisabled}
						description="Draw the upcoming line, smaller, under the current one."
					>
						Show next line
					</SettingsCheckbox>
					<SettingsColor
						configKey="lyrics.overlay.nextLineColor"
						defaultValue={DEFAULT_LYRICS_OVERLAY_SETTINGS.nextLineColor}
						disabled={controlsDisabled || !showNextLine}
						label="Next line colour and opacity"
					/>
					<div className="grid gap-4 sm:grid-cols-2">
						<SettingsColor
							configKey="lyrics.overlay.barBackground"
							defaultValue={DEFAULT_LYRICS_OVERLAY_SETTINGS.barBackground}
							disabled={controlsDisabled || lineStyle !== "bar"}
							label="Progress bar background"
							hint="Unplayed part of the pill behind the current line (Progress bar mode)."
						/>
						<SettingsColor
							configKey="lyrics.overlay.barProgressColor"
							defaultValue={DEFAULT_LYRICS_OVERLAY_SETTINGS.barProgressColor}
							disabled={controlsDisabled || lineStyle !== "bar"}
							label="Progress bar fill"
							hint="Played part of the pill."
						/>
					</div>
					<SettingsCheckbox
						configKey="lyrics.overlay.textOutline"
						defaultValue={DEFAULT_LYRICS_OVERLAY_SETTINGS.textOutline}
						disabled={controlsDisabled}
						description="Crisp stroke around every glyph so light text stays readable over bright windows."
					>
						Text outline
					</SettingsCheckbox>
					<div className="grid gap-4 sm:grid-cols-2">
						<SettingsColor
							configKey="lyrics.overlay.outlineColor"
							defaultValue={DEFAULT_LYRICS_OVERLAY_SETTINGS.outlineColor}
							disabled={controlsDisabled || !textOutline}
							label="Outline colour"
						/>
						<SettingsInput
							configKey="lyrics.overlay.outlineWidth"
							type="number"
							step={0.5}
							min={LYRICS_OVERLAY_OUTLINE_WIDTH.min}
							max={LYRICS_OVERLAY_OUTLINE_WIDTH.max}
							defaultValue={DEFAULT_LYRICS_OVERLAY_SETTINGS.outlineWidth}
							disabled={controlsDisabled || !textOutline}
							label="Outline width (px)"
						/>
					</div>
					<SettingsCheckbox
						configKey="lyrics.overlay.textShadow"
						defaultValue={DEFAULT_LYRICS_OVERLAY_SETTINGS.textShadow}
						disabled={controlsDisabled}
						description="Soft drop shadow under the glyphs, separate from the outline."
					>
						Text shadow
					</SettingsCheckbox>
					<SettingsColor
						configKey="lyrics.overlay.shadowColor"
						defaultValue={DEFAULT_LYRICS_OVERLAY_SETTINGS.shadowColor}
						disabled={controlsDisabled || !textShadow}
						label="Shadow colour"
					/>
				</FieldGroup>
			</CardContent>
			<CardFooter className="gap-3">
				<Button type="button" variant="outline" size="sm" disabled={controlsDisabled} onClick={() => resetPosition()}>
					Reset position
				</Button>
				<p className="text-xs text-muted-foreground">Moves the window back to the bottom of the primary display.</p>
			</CardFooter>
		</Card>
	);
}

function LyricsSettingsPage() {
	const [lyricsEnabled] = useSettingsState<boolean>("lyrics.enabled", false);

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle>Lyrics</CardTitle>
					<CardDescription>
						Replace the YouTube Music Lyrics tab with timed lyrics. Word or syllable highlighting uses whatever the
						winning provider returns.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<SettingsCheckbox
							configKey="lyrics.enabled"
							description="When enabled, open the Lyrics tab in the player to see synced lines. Click a line or word to seek."
						>
							Enable lyrics
						</SettingsCheckbox>
						<SettingsCheckbox
							configKey="lyrics.autoOpenTab"
							defaultValue={true}
							disabled={!lyricsEnabled}
							description="Switch the player page to the Lyrics tab when lyrics for a new track are found. Once per track, so switching away by hand sticks."
						>
							Auto-open Lyrics tab
						</SettingsCheckbox>
						<SettingsCheckbox
							configKey="lyrics.preferWordSync"
							defaultValue={true}
							disabled={!lyricsEnabled}
							description="Keep trying later providers for word/syllable timing before settling for line-synced lyrics. A few extra requests on line-only songs."
						>
							Prefer word-synced sources
						</SettingsCheckbox>
						<SettingsCheckbox
							configKey="lyrics.showEvenIfInexact"
							defaultValue={true}
							disabled={!lyricsEnabled}
							description="For LRCLib matches, show lyrics when title/artist are close but not exact."
						>
							Allow approximate matches
						</SettingsCheckbox>
						<SettingsCheckbox
							configKey="lyrics.showTimeCodes"
							disabled={!lyricsEnabled}
							description="Prefix each line with its timestamp."
						>
							Show time codes
						</SettingsCheckbox>
						<SettingsCheckbox
							configKey="lyrics.lineBackground"
							defaultValue={true}
							disabled={!lyricsEnabled}
							description="Tint the row behind the current line. Turn off to brighten the text only. The Progress bar style still draws its bar."
						>
							Active line background
						</SettingsCheckbox>
						<SettingsSelect
							configKey="lyrics.lineStyle"
							defaultValue="fill"
							disabled={!lyricsEnabled}
							label="Highlight style"
							description="How the current line shows progress. Text fill needs word/syllable timing from the provider; line timing only says when a line starts, not how fast it's sung, so those songs get a plain highlight or the constant-rate bar."
							options={LINE_STYLE_OPTIONS}
						/>
					</FieldGroup>
				</CardContent>
			</Card>
			<DesktopLyricsCard lyricsEnabled={lyricsEnabled} />
			<Card>
				<CardHeader>
					<CardTitle>Providers</CardTitle>
					<CardDescription>
						Tried in order until one returns lyrics (default: Better Lyrics → Unison → LRCLib → YouTube captions). Better Lyrics and Unison
						can return syllable sync; LRCLib is line/plain (word sync when the entry has it); YouTube captions is line-only and
						uses the current video's own caption track. Toggle sources on or off and drag to reorder.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldGroup>
						<LyricsProvidersOrder disabled={!lyricsEnabled} />
						<SettingsInput
							configKey="lyrics.betterLyricsApiKey"
							type="password"
							autoComplete="off"
							spellCheck={false}
							disabled={!lyricsEnabled}
							placeholder="Optional"
							label="Better Lyrics API key"
							hint={
								<>
									Sent as <code>X-API-Key</code>. Cached songs never need a key; uncached songs do, and Better
									Lyrics is not issuing new keys right now. Without one, play a song once in the Better Lyrics
									browser extension to cache it.
								</>
							}
						/>
					</FieldGroup>
				</CardContent>
				<CardFooter>
					<p className="text-xs text-muted-foreground">Site links open each provider&apos;s homepage or docs.</p>
				</CardFooter>
			</Card>
		</>
	);
}
