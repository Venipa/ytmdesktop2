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
	/** Grey out control (preference still readable). */
	disabled?: boolean;
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
				"-mx-2 items-start rounded-lg px-2 py-2 transition-colors duration-150 ease-out",
				"cursor-pointer hover:bg-muted/50 active:bg-muted/70",
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
				<FieldLabel className="pointer-events-none cursor-pointer">{children}</FieldLabel>
				{description ? <FieldDescription>{description}</FieldDescription> : null}
			</FieldContent>
			<Switch
				id={id}
				checked={value}
				disabled={locked}
				onClick={(event) => event.stopPropagation()}
				onCheckedChange={apply}
			/>
		</Field>
	);
}
