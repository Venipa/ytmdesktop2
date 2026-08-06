import { type ReactNode, useId } from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettingsState } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

export interface SettingsSelectOption {
	value: string;
	label: ReactNode;
}

export interface SettingsSelectProps {
	configKey: string;
	defaultValue?: string;
	label?: ReactNode;
	description?: ReactNode;
	options: SettingsSelectOption[];
	className?: string;
	onChange?: (value: string) => void;
}

export function SettingsSelect({ configKey, defaultValue = "", label, description, options, className, onChange }: SettingsSelectProps) {
	const id = useId();
	const [value, setValue, { isPending }] = useSettingsState<string>(configKey, defaultValue, { debounce: 200 });
	const items = Object.fromEntries(options.map((opt) => [opt.value, opt.label]));

	return (
		<Field data-disabled={isPending || undefined} className={cn(className)}>
			{label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
			{description ? <FieldDescription>{description}</FieldDescription> : null}
			<Select
				value={value}
				items={items}
				disabled={isPending}
				onValueChange={(next) => {
					if (next == null) return;
					setValue(next);
					onChange?.(next);
				}}
			>
				<SelectTrigger id={id} className="w-full" disabled={isPending}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						{options.map((opt) => (
							<SelectItem key={opt.value} value={opt.value}>
								{opt.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
