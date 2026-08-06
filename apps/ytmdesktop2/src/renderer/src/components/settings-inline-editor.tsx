import { type InputHTMLAttributes, type ReactNode, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { useSettingsState } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";

export type SettingsInlineEditorRule =
	| { kind: "number"; min?: number; max?: number; integer?: boolean }
	| { kind: "text"; minLength?: number; maxLength?: number; pattern?: RegExp; patternMessage?: string }
	| { kind: "custom"; validate: (value: string) => string | null };

export interface SettingsInlineEditorProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "defaultValue" | "type"> {
	configKey: string;
	defaultValue?: unknown;
	type?: "text" | "number";
	label?: ReactNode;
	hint?: ReactNode;
	className?: string;
	/** Shown via sonner after the value is saved. */
	updateMessage?: string;
	/** Validation applied before submit. */
	rules?: SettingsInlineEditorRule[];
	/** Format displayed trigger text. */
	formatDisplay?: (value: unknown) => string;
	/** Map input string → persisted value. */
	parse?: (raw: string) => unknown;
}

function validateValue(raw: string, type: "text" | "number", rules: SettingsInlineEditorRule[] | undefined): string | null {
	if (!rules?.length) {
		if (type === "number" && raw.trim() !== "" && !Number.isFinite(Number(raw))) return "Enter a valid number";
		return null;
	}

	for (const rule of rules) {
		if (rule.kind === "number") {
			const n = Number(raw);
			if (!Number.isFinite(n)) return "Enter a valid number";
			if (rule.integer && !Number.isInteger(n)) return "Enter a whole number";
			if (rule.min != null && n < rule.min) return `Must be at least ${rule.min}`;
			if (rule.max != null && n > rule.max) return `Must be at most ${rule.max}`;
			continue;
		}
		if (rule.kind === "text") {
			if (rule.minLength != null && raw.length < rule.minLength) return `Must be at least ${rule.minLength} characters`;
			if (rule.maxLength != null && raw.length > rule.maxLength) return `Must be at most ${rule.maxLength} characters`;
			if (rule.pattern && !rule.pattern.test(raw)) return rule.patternMessage ?? "Invalid format";
			continue;
		}
		const customError = rule.validate(raw);
		if (customError) return customError;
	}
	return null;
}

export function SettingsInlineEditor({
	configKey,
	defaultValue = "",
	type = "text",
	label,
	hint,
	className,
	updateMessage,
	rules,
	formatDisplay,
	parse,
	placeholder,
	...attrs
}: SettingsInlineEditorProps) {
	const id = useId();
	const inputId = `${id}-input`;
	const [value, setValue, { isPending, isSaving }] = useSettingsState(configKey, defaultValue, {
		debounce: 0,
		onPersisted: updateMessage ? () => toast.success(updateMessage) : undefined,
	});
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState("");
	const [error, setError] = useState<string | null>(null);

	const display = formatDisplay ? formatDisplay(value) : String(value ?? "");

	useEffect(() => {
		if (!open) return;
		setDraft(String(value ?? ""));
		setError(null);
	}, [open, value]);

	const handleOpenChange = (next: boolean) => {
		if (isSaving && next) return;
		setOpen(next);
		if (!next) setError(null);
	};

	const handleSubmit = () => {
		const validationError = validateValue(draft, type, rules);
		if (validationError) {
			setError(validationError);
			return;
		}
		const next = parse ? parse(draft) : type === "number" ? Number(draft) : draft;
		setValue(next as typeof value);
		setOpen(false);
	};

	return (
		<Field orientation="horizontal" data-disabled={isPending || undefined} className={cn("items-start", className)}>
			<FieldContent>
				{label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
				{hint ? <FieldDescription>{hint}</FieldDescription> : null}
			</FieldContent>
			<Popover open={open} onOpenChange={handleOpenChange}>
				<PopoverTrigger
					render={
						<button
							id={id}
							type="button"
							disabled={isPending}
							className={cn(
								buttonVariants({ variant: "link", size: "sm" }),
								"h-auto shrink-0 px-0 py-0 font-mono underline underline-offset-4",
								"hover:text-primary/80",
								!display && "text-muted-foreground",
							)}
						/>
					}
				>
					{display || placeholder || "Edit"}
				</PopoverTrigger>
				<PopoverContent
					align="end"
					sideOffset={6}
					className="w-64 gap-3 rounded-xl p-3"
				>
					<PopoverHeader>
						<PopoverTitle>{label ?? "Edit"}</PopoverTitle>
						{hint ? <PopoverDescription className="sr-only">{hint}</PopoverDescription> : null}
					</PopoverHeader>
					<div className="flex flex-col gap-1.5">
						<Input
							id={inputId}
							type={type}
							value={draft}
							placeholder={placeholder}
							autoFocus
							aria-invalid={!!error}
							disabled={isSaving}
							min={attrs.min}
							max={attrs.max}
							onChange={(e) => {
								setDraft(e.target.value);
								if (error) setError(null);
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									handleSubmit();
								}
								if (e.key === "Escape") handleOpenChange(false);
							}}
						/>
						{/* Reserve space so error text does not resize the popover */}
						<div className="min-h-4">{error ? <FieldError>{error}</FieldError> : null}</div>
					</div>
					<div className="flex justify-end gap-2">
						<Button type="button" size="sm" variant="outline" disabled={isSaving} onClick={() => handleOpenChange(false)}>
							Cancel
						</Button>
						<Button type="button" size="sm" disabled={isSaving} onClick={handleSubmit}>
							{isSaving ? "Saving…" : "Save"}
						</Button>
					</div>
				</PopoverContent>
			</Popover>
		</Field>
	);
}
