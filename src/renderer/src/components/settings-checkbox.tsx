import { type ReactNode, useId } from "react";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
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
}

export function SettingsCheckbox({ configKey, defaultValue = false, className, children, description, onChange }: SettingsCheckboxProps) {
	const id = useId();
	const [value, setValue, { isPending }] = useSettingsState<boolean>(configKey, defaultValue, { debounce: 200 });

	return (
		<Field orientation="horizontal" data-disabled={isPending || undefined} className={cn("items-start", className)}>
			<FieldContent>
				<FieldLabel htmlFor={id}>{children}</FieldLabel>
				{description ? <FieldDescription>{description}</FieldDescription> : null}
			</FieldContent>
			<Switch
				id={id}
				checked={value}
				disabled={isPending}
				onCheckedChange={(checked) => {
					setValue(checked);
					onChange?.(checked);
				}}
			/>
		</Field>
	);
}
