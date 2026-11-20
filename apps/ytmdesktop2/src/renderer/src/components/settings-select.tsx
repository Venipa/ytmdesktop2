import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { cva } from "class-variance-authority";
import { type ReactNode, useId, useMemo } from "react";
import { SettingsDescription, settingsLabelClass, settingsRowVariants } from "@/components/settings-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettingsState } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

const radioOptionVariants = cva(
	"flex items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 transition-colors duration-150 ease-out has-data-checked:border-foreground/25 has-data-checked:bg-foreground/4",
	{
		variants: { locked: { true: "cursor-not-allowed", false: "cursor-pointer hover:bg-muted/30" } },
		defaultVariants: { locked: false },
	},
);

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
	disabled?: boolean;
	nested?: boolean;
	onChange?: (value: string) => void;
}

/**
 * Options with descriptions render as a radio list (every choice visible);
 * plain options render as a select on the right of the row.
 */
export function SettingsSelect({
	configKey,
	defaultValue = "",
	label,
	description,
	options,
	className,
	disabled,
	nested,
	onChange,
}: SettingsSelectProps) {
	const id = useId();
	const [value, setValue, { isPending }] = useSettingsState<string>(configKey, defaultValue, { debounce: 200 });
	const locked = isPending || !!disabled;
	const rich = options.some((opt) => opt.description != null);

	const items = useMemo(
		() => Object.fromEntries(options.map((opt) => [opt.value, typeof opt.label === "string" ? opt.label : opt.value])),
		[options],
	);

	const apply = (next: unknown) => {
		if (typeof next !== "string" || next === value) return;
		setValue(next);
		onChange?.(next);
	};

	const text = (
		<div className="flex min-w-0 flex-1 flex-col gap-0.5">
			{label ? (
				<label id={`${id}-label`} htmlFor={rich ? undefined : id} className={settingsLabelClass}>
					{label}
				</label>
			) : null}
			{description ? <SettingsDescription>{description}</SettingsDescription> : null}
		</div>
	);

	if (rich) {
		return (
			<div
				data-disabled={locked || undefined}
				className={cn(settingsRowVariants({ layout: "stack", nested, disabled: locked }), className)}
			>
				{text}
				<RadioGroup
					aria-labelledby={label ? `${id}-label` : undefined}
					value={value}
					disabled={locked}
					onValueChange={apply}
					className="flex flex-col gap-1.5"
				>
					{options.map((opt) => (
						<label
							key={opt.value}
							className={radioOptionVariants({ locked })}
						>
							<Radio.Root
								value={opt.value}
								className={cn(
									"mt-px flex size-3.5 shrink-0 items-center justify-center rounded-full border border-muted-foreground outline-none",
									"focus-visible:ring-2 focus-visible:ring-ring/50 data-checked:border-primary",
								)}
							>
								<Radio.Indicator className="size-1.5 rounded-full bg-primary data-unchecked:hidden" />
							</Radio.Root>
							<span className="flex min-w-0 flex-1 flex-col gap-0.5">
								<span className="text-xs/4 font-medium text-foreground">{opt.label}</span>
								{opt.description ? <span className="text-xs/4 text-muted-foreground">{opt.description}</span> : null}
							</span>
						</label>
					))}
				</RadioGroup>
			</div>
		);
	}

	return (
		<div
			data-disabled={locked || undefined}
			className={cn(settingsRowVariants({ layout: "inline", nested, disabled: locked }), className)}
		>
			{text}
			<Select value={value} items={items} disabled={locked} onValueChange={apply}>
				<SelectTrigger id={id} disabled={locked} className="w-44 shrink-0">
					<SelectValue />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger sideOffset={0}>
					<SelectGroup>
						{options.map((opt) => (
							<SelectItem key={opt.value} value={opt.value} label={typeof opt.label === "string" ? opt.label : opt.value}>
								{opt.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</div>
	);
}
