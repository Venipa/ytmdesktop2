import { RiArrowRightSLine } from "@remixicon/react";
import { cva, type VariantProps } from "class-variance-authority";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

/** Shared row rhythm for every settings row inside a SettingsGroup. */
export const settingsRowVariants = cva("min-h-13 px-3.5 py-3", {
	variants: {
		layout: {
			/** Caller owns flex (e.g. a vertical Field). */
			none: "",
			/** Text left, control right. */
			inline: "flex items-center gap-4",
			/** Text above a full-width control. */
			stack: "flex flex-col gap-2",
			/** Horizontal Field: undo its items-start when FieldContent is present. */
			field: "items-center gap-4 has-[>[data-slot=field-content]]:items-center *:data-[slot=field-content]:min-w-0",
		},
		/** Indent under the setting it depends on. */
		nested: { true: "pl-8", false: "" },
		disabled: { true: "opacity-50", false: "" },
		/** Whole row toggles the control. */
		interactive: {
			true: "cursor-pointer transition-colors duration-150 ease-out hover:bg-muted/30 active:bg-muted/50",
			false: "",
		},
	},
	defaultVariants: { layout: "none", nested: false, disabled: false, interactive: false },
});
export type SettingsRowVariants = VariantProps<typeof settingsRowVariants>;

export const settingsLabelClass = "text-[13px]/[18px] font-medium";

export interface SettingsGroupProps {
	title?: ReactNode;
	/** One short line under the heading. */
	description?: ReactNode;
	/** Right side of the heading (e.g. "Reset all"). */
	action?: ReactNode;
	/** Muted line under the list (links, notes). */
	footer?: ReactNode;
	className?: string;
	children?: ReactNode;
}

/** Heading + one rounded list; rows are separated by hairlines. */
export function SettingsGroup({ title, description, action, footer, className, children }: SettingsGroupProps) {
	return (
		<section className={cn("flex flex-col gap-2", className)}>
			{title || action ? (
				<div className="flex min-h-7 items-end justify-between gap-4 px-0.5">
					<div className="flex min-w-0 flex-col gap-0.5">
						{title ? <h2 className="flex items-center gap-2 text-xs/4 font-semibold text-muted-foreground">{title}</h2> : null}
						{description ? <SettingsDescription>{description}</SettingsDescription> : null}
					</div>
					{action}
				</div>
			) : null}
			<div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg bg-card text-card-foreground ring-1 ring-foreground/10">
				{children}
			</div>
			{footer ? <div className="px-0.5 text-xs/4 text-muted-foreground">{footer}</div> : null}
		</section>
	);
}

export interface SettingsRowProps {
	label?: ReactNode;
	description?: ReactNode;
	/** Control shown on the right. */
	children?: ReactNode;
	nested?: boolean;
	disabled?: boolean;
	className?: string;
}

/** Label/description left, control right. For settings not backed by a SettingsCheckbox/Select. */
export function SettingsRow({ label, description, children, nested, disabled, className }: SettingsRowProps) {
	return (
		<div
			data-disabled={disabled || undefined}
			className={cn(settingsRowVariants({ layout: "inline", nested, disabled }), className)}
		>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				{label ? <div className={settingsLabelClass}>{label}</div> : null}
				{description ? <SettingsDescription>{description}</SettingsDescription> : null}
			</div>
			{children}
		</div>
	);
}

/** Free-form padded block inside a group (previews, lists, button rows). */
export function SettingsGroupBody({ className, children }: { className?: string; children?: ReactNode }) {
	return <div className={cn("flex flex-col gap-3 p-3.5", className)}>{children}</div>;
}

/** Muted description clamped to one line; "More" appears only when the text overflows. */
export function SettingsDescription({ className, children }: { className?: string; children?: ReactNode }) {
	const ref = useRef<HTMLParagraphElement>(null);
	const [expanded, setExpanded] = useState(false);
	const [overflows, setOverflows] = useState(false);

	useLayoutEffect(() => {
		const el = ref.current;
		if (!el || expanded) return;
		const measure = () => setOverflows(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, [expanded, children]);

	return (
		<div className={cn("flex min-w-0 items-baseline gap-1.5 text-xs/4 font-normal text-muted-foreground", className)}>
			<p
				ref={ref}
				data-slot="field-description"
				className={cn("min-w-0 flex-1", !expanded && "truncate", "[&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-foreground")}
			>
				{children}
			</p>
			{overflows || expanded ? (
				<button
					type="button"
					className="shrink-0 text-foreground/80 underline-offset-4 hover:text-foreground hover:underline"
					onClick={(event) => {
						event.stopPropagation();
						setExpanded((v) => !v);
					}}
				>
					{expanded ? "Less" : "More"}
				</button>
			) : null}
		</div>
	);
}

export interface SettingsAdvancedProps {
	label?: ReactNode;
	/** Settings inside; the section opens by itself when any is not at its default. */
	watch?: ReadonlyArray<readonly [key: string, defaultValue: unknown]>;
	/** Shown on the right, e.g. "4 settings". Defaults to the watch count. */
	summary?: ReactNode;
	children?: ReactNode;
}

/** Collapsed "Advanced" row inside a SettingsGroup. */
export function SettingsAdvanced({ label = "Advanced", watch = [], summary, children }: SettingsAdvancedProps) {
	const queries = trpc.useQueries((t) => watch.map(([key, defaultValue]) => t.settings.get({ key, defaultValue: defaultValue ?? null })));
	const changed = queries.some((q, i) => q.isSuccess && q.data != null && q.data !== watch[i][1]);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (changed) setOpen(true);
	}, [changed]);

	const count = summary ?? (watch.length ? `${watch.length} ${watch.length === 1 ? "setting" : "settings"}` : null);

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger
				className={cn(
					"flex w-full items-center gap-2 text-left text-xs/4 font-medium text-muted-foreground transition-colors duration-150 ease-out",
					"min-h-11 px-3.5 py-3 hover:bg-muted/30 hover:text-foreground",
				)}
			>
				<RiArrowRightSLine className={cn("size-4 transition-transform duration-150 ease-out", open && "rotate-90")} />
				<span>{label}</span>
				{count ? <span className="ml-auto font-normal">{count}</span> : null}
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="flex flex-col divide-y divide-border border-t border-border">{children}</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
