import { joinHexColor, splitHexColor } from "@shared/lyrics/overlay";
import { type ReactNode, useId } from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useSettingsState } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

export interface SettingsColorProps {
	configKey: string;
	/** `#rrggbb` or `#rrggbbaa`. */
	defaultValue: string;
	label?: ReactNode;
	hint?: ReactNode;
	className?: string;
	disabled?: boolean;
	/** Show the opacity slider (stored as the alpha byte of the same key). */
	withOpacity?: boolean;
}

/** Colour picker (+ optional opacity slider) persisted as one `#rrggbb[aa]` string. */
export function SettingsColor({ configKey, defaultValue, label, hint, className, disabled, withOpacity = true }: SettingsColorProps) {
	const id = useId();
	const [value, setValue, { isPending }] = useSettingsState<string>(configKey, defaultValue, { debounce: 200 });
	const { hex, alpha } = splitHexColor(typeof value === "string" ? value : defaultValue);
	const percent = Math.round(alpha * 100);
	const locked = disabled || isPending;

	return (
		<Field data-disabled={locked || undefined} className={cn(className)}>
			{label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
			<div className="flex items-center gap-3">
				<Input
					id={id}
					type="color"
					className="h-8 w-12 shrink-0 cursor-pointer p-1"
					value={hex}
					disabled={locked}
					onChange={(ev) => setValue(joinHexColor(ev.target.value, alpha))}
				/>
				{withOpacity ? (
					<>
						<Slider
							aria-label="Opacity"
							min={0}
							max={100}
							step={1}
							disabled={locked}
							value={[percent]}
							onValueChange={(next) => {
								const n = Array.isArray(next) ? next[0] : next;
								if (typeof n !== "number" || !Number.isFinite(n)) return;
								setValue(joinHexColor(hex, n / 100));
							}}
						/>
						<span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{percent}%</span>
					</>
				) : null}
			</div>
			{hint ? <FieldDescription>{hint}</FieldDescription> : null}
		</Field>
	);
}
