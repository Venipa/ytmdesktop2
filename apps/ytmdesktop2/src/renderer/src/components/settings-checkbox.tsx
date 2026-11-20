import { type ReactNode, useId } from "react";
import { toast } from "sonner";
import { SettingsDescription, settingsLabelClass, settingsRowVariants } from "@/components/settings-group";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useSettingsState } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

export interface SettingsCheckboxProps {
	configKey: string;
	defaultValue?: boolean;
	className?: string;
	children?: ReactNode;
	description?: ReactNode;
	onChange?: (value: boolean) => void;
	/** Shown via sonner after the value is saved. */
	updateMessage?: string;
	/** Grey out control (preference still readable). */
	disabled?: boolean;
	/** Indent under the setting it depends on. */
	nested?: boolean;
}

export function SettingsCheckbox({
	configKey,
	defaultValue = false,
	className,
	children,
	description,
	onChange,
	updateMessage,
	disabled = false,
	nested = false,
}: SettingsCheckboxProps) {
	const id = useId();
	const [value, setValue, { isPending }] = useSettingsState<boolean>(configKey, defaultValue, {
		debounce: 200,
		onPersisted: updateMessage ? () => toast.success(updateMessage) : undefined,
	});

	const locked = disabled || isPending;

	const apply = (checked: boolean) => {
		if (locked || checked === value) return;
		setValue(checked);
		onChange?.(checked);
	};

	return (
		<Field
			orientation="horizontal"
			data-disabled={locked || undefined}
			className={cn(
				settingsRowVariants({ layout: "field", nested, interactive: true }),
				"data-disabled:cursor-not-allowed data-disabled:opacity-50 data-disabled:hover:bg-transparent data-disabled:active:bg-transparent",
				className,
			)}
			onClick={(event) => {
				if (locked) return;
				const target = event.target as HTMLElement | null;
				if (target?.closest("a, button, [role='link']")) return;
				apply(!value);
			}}
		>
			<FieldContent>
				{/* No htmlFor — row onClick owns the toggle (avoids double-fire with Switch). */}
				<FieldLabel id={`${id}-label`} className={cn("pointer-events-none cursor-pointer", settingsLabelClass)}>{children}</FieldLabel>
				{description ? <SettingsDescription>{description}</SettingsDescription> : null}
			</FieldContent>
			<Switch
				id={id}
				aria-labelledby={`${id}-label`}
				checked={value}
				disabled={locked}
				onClick={(event) => event.stopPropagation()}
				onCheckedChange={apply}
			/>
		</Field>
	);
}
