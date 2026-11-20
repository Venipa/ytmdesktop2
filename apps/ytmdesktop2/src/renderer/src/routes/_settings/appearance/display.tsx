import { createFileRoute } from "@tanstack/react-router";
import { SettingsDescription, SettingsGroup, SettingsGroupBody, settingsLabelClass } from "@/components/settings-group";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useSettingsState } from "@/hooks/use-settings";

export const Route = createFileRoute("/_settings/appearance/display")({
	component: DisplaySettingsPage,
});

const ZOOM_MIN_PERCENT = 80;
const ZOOM_MAX_PERCENT = 150;
const ZOOM_STEP_PERCENT = 5;

function DisplaySettingsPage() {
	const [zoomFactor, setZoomFactor, { isPending }] = useSettingsState("app.zoomFactor", 1);
	const percent = Math.round(zoomFactor * 100);

	const setZoomPercent = (raw: number) => {
		const stepped = Math.round(raw / ZOOM_STEP_PERCENT) * ZOOM_STEP_PERCENT;
		const clamped = Math.min(ZOOM_MAX_PERCENT, Math.max(ZOOM_MIN_PERCENT, stepped));
		setZoomFactor(clamped / 100);
	};

	return (
		<SettingsGroup
			title="Display"
			description="Scale the YouTube Music page only. Toolbar, settings, and tray view stay at 100%; OS display scaling still applies."
		>
			<SettingsGroupBody>
				<div className="flex items-center justify-between gap-4">
					<label htmlFor="youtube-zoom" className={settingsLabelClass}>
						YouTube zoom
					</label>
					<span className="text-xs/4 tabular-nums text-muted-foreground">{percent}%</span>
				</div>
				<Slider
					id="youtube-zoom"
					min={ZOOM_MIN_PERCENT}
					max={ZOOM_MAX_PERCENT}
					step={ZOOM_STEP_PERCENT}
					disabled={isPending}
					value={[percent]}
					onValueChange={(value) => {
						const next = Array.isArray(value) ? value[0] : value;
						if (typeof next !== "number" || !Number.isFinite(next)) return;
						setZoomPercent(next);
					}}
				/>
				<div className="flex items-center justify-between gap-4">
					<SettingsDescription>80% to 150%. Applies live to the YouTube Music view only.</SettingsDescription>
					<Button type="button" size="sm" variant="outline" disabled={isPending || percent === 100} onClick={() => setZoomPercent(100)}>
						Reset to 100%
					</Button>
				</div>
			</SettingsGroupBody>
		</SettingsGroup>
	);
}
