import {
	DEFAULT_LYRICS_PROVIDERS,
	LYRICS_PROVIDER_META,
	moveLyricsProvider,
	normalizeLyricsProviders,
	setLyricsProviderEnabled,
	type LyricsProviderEntry,
	type LyricsProviderId,
} from "@plugins/youtube/lyrics/providers/catalog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useSettingsState } from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import { type DragEvent, type KeyboardEvent, useCallback, useId, useRef, useState } from "react";

export function LyricsProvidersOrder({ disabled = false }: { disabled?: boolean }) {
	const listId = useId();
	const listRef = useRef<HTMLUListElement | null>(null);
	const [providers, setProviders] = useSettingsState<LyricsProviderEntry[]>(
		"lyrics.providers",
		DEFAULT_LYRICS_PROVIDERS,
		{
			debounce: 200,
			map: (raw) => normalizeLyricsProviders(raw),
		},
	);
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [overIndex, setOverIndex] = useState<number | null>(null);
	const dragIndexRef = useRef<number | null>(null);

	const move = useCallback(
		(from: number, to: number) => {
			if (disabled) return;
			const next = moveLyricsProvider(providers, from, to);
			if (!next) return;
			setProviders(next);
			return next[to];
		},
		[disabled, providers, setProviders],
	);

	const setEnabled = useCallback(
		(id: LyricsProviderId, enabled: boolean) => {
			if (disabled) return;
			setProviders(setLyricsProviderEnabled(providers, id, enabled));
		},
		[disabled, providers, setProviders],
	);

	const clearDrag = useCallback(() => {
		dragIndexRef.current = null;
		setDragIndex(null);
		setOverIndex(null);
	}, []);

	const focusProvider = (id: LyricsProviderId) => {
		requestAnimationFrame(() => {
			listRef.current?.querySelector<HTMLElement>(`[data-provider-id="${id}"]`)?.focus();
		});
	};

	const onRowKeyDown = (index: number, id: LyricsProviderId, ev: KeyboardEvent<HTMLLIElement>) => {
		if (disabled) return;
		if (ev.key === "ArrowUp") {
			ev.preventDefault();
			const moved = move(index, index - 1);
			if (moved) focusProvider(id);
			return;
		}
		if (ev.key === "ArrowDown") {
			ev.preventDefault();
			const moved = move(index, index + 1);
			if (moved) focusProvider(id);
		}
	};

	const onListDragLeave = (ev: DragEvent<HTMLUListElement>) => {
		const related = ev.relatedTarget as Node | null;
		if (related && listRef.current?.contains(related)) return;
		setOverIndex(null);
	};

	return (
		<div className={cn("no-drag", disabled && "pointer-events-none opacity-50")}>
			<ul
				ref={listRef}
				id={listId}
				className="no-drag flex flex-col gap-2"
				aria-label="Lyrics provider priority"
				onDragLeave={onListDragLeave}
			>
				{providers.map((entry, index) => {
					const meta = LYRICS_PROVIDER_META[entry.id];
					const switchId = `${listId}-${entry.id}`;
					return (
						<li
							key={entry.id}
							data-provider-id={entry.id}
							tabIndex={disabled ? -1 : 0}
							aria-grabbed={dragIndex === index}
							aria-keyshortcuts="ArrowUp ArrowDown"
							onKeyDown={(ev) => onRowKeyDown(index, entry.id, ev)}
							onDragOver={(ev) => {
								ev.preventDefault();
								ev.dataTransfer.dropEffect = "move";
								setOverIndex(index);
							}}
							onDrop={(ev) => {
								ev.preventDefault();
								const from = dragIndexRef.current;
								if (from != null) move(from, index);
								clearDrag();
							}}
							className={cn(
								"no-drag rounded-lg border border-border bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring",
								!entry.enabled && "opacity-60",
								overIndex === index && dragIndex != null && dragIndex !== index && "border-primary",
								dragIndex === index && "opacity-50",
							)}
						>
							<div className="flex items-start gap-3 px-3 pt-3 pb-2">
								<div
									role="button"
									tabIndex={disabled ? -1 : 0}
									draggable={!disabled}
									aria-label={`Reorder ${meta.label}`}
									aria-disabled={disabled || undefined}
									className={cn(
										"no-drag mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
										disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
									)}
									onDragStart={(ev) => {
										if (disabled) {
											ev.preventDefault();
											return;
										}
										ev.dataTransfer.effectAllowed = "move";
										ev.dataTransfer.setData("text/plain", entry.id);
										const row = (ev.currentTarget as HTMLElement).closest("li");
										if (row) {
											const rect = row.getBoundingClientRect();
											ev.dataTransfer.setDragImage(row, Math.min(24, rect.width / 4), 16);
										}
										dragIndexRef.current = index;
										setDragIndex(index);
									}}
									onDragEnd={clearDrag}
									onKeyDown={(ev) => {
										if (ev.key === "Enter" || ev.key === " ") ev.preventDefault();
										ev.stopPropagation();
									}}
								>
									<GripVertical className="size-5" aria-hidden />
								</div>
								<span className="mt-1 w-3 shrink-0 text-xs tabular-nums text-muted-foreground text-right">{index + 1}</span>
								<div className="min-w-0 flex-1 space-y-1">
									<div className="text-sm font-medium leading-snug">{meta.label}</div>
									<div className="text-xs leading-snug text-muted-foreground">{meta.syncLevels}</div>
								</div>
								<Switch
									id={switchId}
									size="default"
									className="mt-0.5"
									checked={entry.enabled}
									disabled={disabled}
									aria-label={`Enable ${meta.label}`}
									onClick={(ev) => ev.stopPropagation()}
									onPointerDown={(ev) => ev.stopPropagation()}
									onCheckedChange={(checked) => setEnabled(entry.id, checked)}
								/>
							</div>
							<Separator />
							<div className="px-3 py-1 pl-[3.25rem]">
								<a
									href={meta.href}
									target="_blank"
									rel="noreferrer"
									className="text-xs text-primary underline-offset-4 hover:underline"
									onClick={(ev) => ev.stopPropagation()}
									onMouseDown={(ev) => ev.stopPropagation()}
									tabIndex={disabled ? -1 : 0}
								>
									Site
								</a>
							</div>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
