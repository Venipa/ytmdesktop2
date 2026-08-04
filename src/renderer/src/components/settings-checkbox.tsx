import { debounce } from "lodash-es";
import { type ReactNode, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useSetting } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

export interface SettingsCheckboxProps {
	configKey: string;
	defaultValue?: boolean;
	className?: string;
	children?: ReactNode;
	onChange?: (value: boolean) => void;
}

export function SettingsCheckbox({ configKey, defaultValue, className, children, onChange }: SettingsCheckboxProps) {
	const [value, setValue] = useSetting<boolean>(configKey, defaultValue ?? false);

	const updateSetting = useMemo(
		() =>
			debounce((next: boolean) => {
				setValue(next);
				onChange?.(next);
			}, 200),
		[setValue, onChange],
	);

	return (
		<div className={cn("flex items-center justify-between gap-4 py-1", className)}>
			<Label className="flex-1 text-sm text-muted-foreground">{children}</Label>
			<Checkbox checked={value} onCheckedChange={(checked) => updateSetting(checked === true)} />
		</div>
	);
}
