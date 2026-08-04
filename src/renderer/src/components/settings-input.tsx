import { clamp, debounce } from "lodash-es";
import { type InputHTMLAttributes, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSetting } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

export interface SettingsInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "defaultValue"> {
	configKey: string;
	defaultValue?: unknown;
	min?: number;
	max?: number;
	label?: ReactNode;
	hint?: ReactNode;
	className?: string;
}

export function SettingsInput({ configKey, defaultValue, min, max, label, hint, className, type = "text", ...attrs }: SettingsInputProps) {
	const [storedValue, setStoredValue] = useSetting(configKey, defaultValue ?? "");
	const [value, setValue] = useState<any>(storedValue ?? defaultValue ?? "");
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setValue(storedValue ?? defaultValue ?? "");
	}, [storedValue, defaultValue]);

	const updateSetting = useMemo(
		() =>
			debounce((ev: HTMLInputElement) => {
				if (ev.type === "file" && (!ev.files || ev.files.length === 0)) return;
				let inputValue: unknown;
				if (ev.type === "number" && (min !== undefined || max !== undefined)) {
					const minValue = min ?? ev.valueAsNumber;
					const maxValue = max ?? ev.valueAsNumber;
					inputValue = clamp(Number(ev.value), minValue, maxValue);
				} else {
					inputValue = ev.type === "file" ? window.api.getPathFromFile(ev.files![0]) : ev.value;
				}
				setStoredValue(inputValue as typeof storedValue);
			}, 500),
		[setStoredValue, min, max],
	);

	if (type === "file") {
		return (
			<div className={cn("flex flex-col gap-2", className)}>
				{label && <Label>{label}</Label>}
				<div className="flex items-center gap-2">
					<div className="flex h-12 flex-1 items-center rounded-lg bg-white/5 px-3 text-sm text-muted-foreground">{value}</div>
					<Button type="button" onClick={() => fileInputRef.current?.click()}>
						Browse
					</Button>
				</div>
				<input
					ref={fileInputRef}
					type="file"
					className="hidden"
					accept={attrs.accept}
					onChange={(ev) => updateSetting(ev.target)}
				/>
				{hint}
			</div>
		);
	}

	return (
		<div className={cn("flex flex-col gap-2", className)}>
			{label && <Label>{label}</Label>}
			<Input
				type={type}
				placeholder={attrs.placeholder}
				value={value ?? ""}
				min={min}
				max={max}
				onChange={(ev) => updateSetting(ev.target)}
			/>
			{hint}
		</div>
	);
}
