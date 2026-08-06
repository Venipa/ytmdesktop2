import { type ReactNode, useId, useMemo } from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettingsState } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

export interface SettingsSelectOption {
	value: string;
	label: ReactNode;
	description?: ReactNode;
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

function OptionContent({ label, description, compact }: { label: ReactNode; description?: ReactNode; compact?: boolean }) {
	return (
		<span className={cn("flex min-w-0 flex-1 flex-col text-left", compact ? "gap-0.5" : "gap-1")}>
			<span className="text-xs font-medium leading-snug text-foreground">{label}</span>
			{description ? (
				<span className="text-xs font-normal leading-snug whitespace-normal text-muted-foreground">{description}</span>
			) : null}
		</span>
	);
}

export function SettingsSelect({ configKey, defaultValue = "", label, description, options, className, onChange }: SettingsSelectProps) {
	const id = useId();
	const [value, setValue, { isPending }] = useSettingsState<string>(configKey, defaultValue, { debounce: 200 });
	const rich = options.some((opt) => opt.description != null);
	const selected = options.find((opt) => opt.value === value) ?? options.find((opt) => opt.value === defaultValue);

	const items = useMemo(
		() => Object.fromEntries(options.map((opt) => [opt.value, typeof opt.label === "string" ? opt.label : opt.value])),
		[options],
	);

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
				<SelectTrigger
					id={id}
					disabled={isPending}
					className={cn(
						"w-full",
						rich &&
							"h-auto! min-h-8 items-start whitespace-normal py-2 data-[size=default]:h-auto! *:data-[slot=select-value]:line-clamp-none",
					)}
				>
					<SelectValue>
						{rich && selected ? (
							<OptionContent label={selected.label} description={selected.description} compact />
						) : null}
					</SelectValue>
				</SelectTrigger>
				<SelectContent alignItemWithTrigger sideOffset={0}>
					<SelectGroup>
						{options.map((opt) => (
							<SelectItem
								key={opt.value}
								value={opt.value}
								label={typeof opt.label === "string" ? opt.label : opt.value}
								className={cn(opt.description && "items-start py-2 *:[span]:last:items-start")}
							>
								{opt.description ? (
									<OptionContent label={opt.label} description={opt.description} compact />
								) : (
									opt.label
								)}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
