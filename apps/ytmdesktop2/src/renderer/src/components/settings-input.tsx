import { clamp } from "lodash-es";
import { type InputHTMLAttributes, type ReactNode, useId, useRef } from "react";
import { toast } from "sonner";
import { SettingsDescription, settingsLabelClass, settingsRowVariants } from "@/components/settings-group";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSettingsState } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

const DEFAULT_INPUT_DEBOUNCE_MS = 800;

export interface SettingsInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "defaultValue"> {
	configKey: string;
	defaultValue?: unknown;
	min?: number;
	max?: number;
	label?: ReactNode;
	hint?: ReactNode;
	className?: string;
	/** Persist debounce in ms (default 800). Keeps field editable while typing. */
	debounce?: number;
	/** Shown via sonner after the value is saved. */
	updateMessage?: string;
	/** Indent under the setting it depends on. */
	nested?: boolean;
}

export function SettingsInput({
	configKey,
	defaultValue = "",
	min,
	max,
	label,
	hint,
	className,
	type = "text",
	debounce = DEFAULT_INPUT_DEBOUNCE_MS,
	updateMessage,
	nested,
	...attrs
}: SettingsInputProps) {
	const id = useId();
	const [value, setValue, { isPending }] = useSettingsState(configKey, defaultValue, {
		debounce,
		onPersisted: updateMessage ? () => toast.success(updateMessage) : undefined,
	});
	const fileInputRef = useRef<HTMLInputElement>(null);

	if (type === "file") {
		return (
			<Field data-disabled={isPending || undefined} className={cn("gap-2", settingsRowVariants({ nested, disabled: attrs.disabled }), className)}>
				{label ? <FieldLabel htmlFor={id} className={settingsLabelClass}>{label}</FieldLabel> : null}
				<FieldContent>
					<div className="flex items-center gap-2">
						<div className="flex h-8 min-w-0 flex-1 items-center truncate rounded-lg border border-input bg-transparent px-2.5 text-xs text-muted-foreground">
							{String(value || "No file selected")}
						</div>
						<Button type="button" variant="outline" size="sm" disabled={isPending || attrs.disabled} onClick={() => fileInputRef.current?.click()}>
							Browse
						</Button>
					</div>
					<input
						ref={fileInputRef}
						id={id}
						type="file"
						className="hidden"
						accept={attrs.accept}
						disabled={isPending || attrs.disabled}
						onChange={(ev) => {
							const file = ev.target.files?.[0];
							if (!file) return;
							setValue(window.api.getPathFromFile(file));
						}}
					/>
					{hint}
				</FieldContent>
			</Field>
		);
	}

	return (
		<Field data-disabled={isPending || undefined} className={cn("gap-2", settingsRowVariants({ nested, disabled: attrs.disabled }), className)}>
			{label ? <FieldLabel htmlFor={id} className={settingsLabelClass}>{label}</FieldLabel> : null}
			<Input
				{...attrs}
				id={id}
				type={type}
				value={String(value ?? "")}
				min={min}
				max={max}
				disabled={isPending || attrs.disabled}
				onChange={(ev) => {
					if (type === "number" && (min !== undefined || max !== undefined)) {
						const n = Number(ev.target.value);
						if (!Number.isFinite(n)) {
							setValue(ev.target.value);
							return;
						}
						setValue(clamp(n, min ?? n, max ?? n));
						return;
					}
					setValue(ev.target.value);
				}}
			/>
			{hint ? <SettingsDescription>{hint}</SettingsDescription> : null}
		</Field>
	);
}
