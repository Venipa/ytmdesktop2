import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { useSettingsState } from "@/hooks/use-settings";

export const Route = createFileRoute("/_settings/appearance/display")({
	component: DisplaySettingsPage,
});

const ZOOM_MIN_PERCENT = 80;
const ZOOM_MAX_PERCENT = 150;
const ZOOM_STEP_PERCENT = 5;

function DisplaySettingsPage() {
	const [zoomFactor, setZoomFactor, { isPending }] = useSettingsState("app.zoomFactor", 1, { debounce: 100 });
	const percent = Math.round(zoomFactor * 100);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Display</CardTitle>
				<CardDescription>
					Scale the YouTube Music page only. Toolbar, settings, and miniplayer stay at 100%; OS display scaling still applies.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<Field>
						<div className="flex items-center justify-between gap-4">
							<FieldLabel htmlFor="youtube-zoom">YouTube zoom</FieldLabel>
							<span className="tabular-nums text-sm text-muted-foreground">{percent}%</span>
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
								setZoomFactor(next / 100);
							}}
						/>
						<FieldDescription>80% to 150%. Applies live to the YouTube Music view only.</FieldDescription>
						<div className="flex justify-end">
							<Button
								type="button"
								size="sm"
								variant="outline"
								disabled={isPending || percent === 100}
								onClick={() => setZoomFactor(1)}
							>
								Reset to 100%
							</Button>
						</div>
					</Field>
				</FieldGroup>
			</CardContent>
		</Card>
	);
}
