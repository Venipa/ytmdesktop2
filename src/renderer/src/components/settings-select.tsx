import { debounce } from "lodash-es";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSetting } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

export interface SettingsSelectOption {
	value: string;
	label: ReactNode;
}

export interface SettingsSelectProps {
	configKey: string;
	defaultValue?: string;
	label?: ReactNode;
	options: SettingsSelectOption[];
	className?: string;
	onChange?: (value: string) => void;
}

export function SettingsSelect({ configKey, defaultValue, label, options, className, onChange }: SettingsSelectProps) {
	const [storedValue, setStoredValue] = useSetting<string>(configKey, defaultValue ?? "");
	const [value, setValue] = useState<string>((storedValue as string) ?? defaultValue ?? "");

	useEffect(() => {
		setValue((storedValue as string) ?? defaultValue ?? "");
	}, [storedValue, defaultValue]);

	const updateSetting = useMemo(
		() =>
			debounce((next: string | null) => {
				if (next == null) return;
				setStoredValue(next);
				onChange?.(next);
			}, 200),
		[setStoredValue, onChange],
	);

	return (
		<div className={cn("flex flex-col gap-2", className)}>
			{label && <Label>{label}</Label>}
			<Select value={value} onValueChange={updateSetting}>
				<SelectTrigger className="w-full">
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
		</div>
	);
}
