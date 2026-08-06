import { type ReactNode, useId } from "react";
import { toast } from "sonner";
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
	/** Shown via sonner after the value is saved. */
	updateMessage?: string;
}

export function SettingsCheckbox({
	configKey,
	defaultValue = false,
	className,
	children,
	description,
	onChange,
	updateMessage,
}: SettingsCheckboxProps) {
	const id = useId();
	const [value, setValue, { isPending }] = useSettingsState<boolean>(configKey, defaultValue, {
		debounce: 200,
		onPersisted: updateMessage ? () => toast.success(updateMessage) : undefined,
	});

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
					if (checked === value) return;
					setValue(checked);
					onChange?.(checked);
				}}
			/>
		</Field>
	);
}
