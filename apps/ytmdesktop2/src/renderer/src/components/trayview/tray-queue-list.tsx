import { toAppThumbUrl } from "@shared/media/appThumbUrl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function formatQueueLength(sec: number): string {
	const s = Math.max(0, Math.floor(sec));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const r = s % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
	return `${m}:${String(r).padStart(2, "0")}`;
}

const EQ_BARS = [
	{ delay: "0ms", duration: "0.72s" },
	{ delay: "120ms", duration: "0.58s" },
	{ delay: "80ms", duration: "0.86s" },
	{ delay: "200ms", duration: "0.64s" },
] as const;

function QueueEqBars({ paused }: { paused: boolean }) {
	return (
		<span className="tray-eq absolute inset-0 flex items-end justify-center gap-px rounded bg-black/50 pb-1" data-paused={paused ? "" : undefined} aria-hidden>
			{EQ_BARS.map((bar, i) => (
				<span
					key={i}
					className="tray-eq-bar w-0.5 rounded-full bg-white"
					style={{ height: "70%", animationDelay: bar.delay, animationDuration: bar.duration }}
				/>
			))}
		</span>
	);
}

function QueueItemSkeleton({ wide }: { wide?: boolean }) {
	return (
		<li className="flex items-center gap-2 rounded-md px-2.5 py-1.5" aria-hidden>
			<Skeleton className="size-7 shrink-0 rounded" />
			<span className="min-w-0 flex-1 space-y-1">
				<Skeleton className={cn("h-2.5", wide ? "w-4/5" : "w-3/5")} />
				<Skeleton className={cn("h-2", wide ? "w-1/2" : "w-1/3")} />
			</span>
			<Skeleton className="h-2 w-7 shrink-0" />
		</li>
	);
}

function QueueItemSkeletons({ count }: { count: number }) {
	return Array.from({ length: count }, (_, i) => <QueueItemSkeleton key={`sk-${i}`} wide={i % 2 === 0} />);
}

type TrayQueueListProps = {
	currentVideoId?: string;
	accent: string | null;
	playing: boolean;
};

export function TrayQueueList({ currentVideoId, accent, playing }: TrayQueueListProps) {
	const utils = trpc.useUtils();
	const { data, refetch, isFetching, isError, isLoading } = trpc.navigation.queueList.useQuery(undefined, {
		refetchOnWindowFocus: false,
		retry: 6,
		retryDelay: 400,
	});
	const { mutateAsync: queuePlay } = trpc.navigation.queuePlay.useMutation();
	const [atEnd, setAtEnd] = useState(false);
	const [playingIndex, setPlayingIndex] = useState<number | null>(null);
	const countRef = useRef(0);
	countRef.current = data?.count ?? 0;
	const fetchingRef = useRef(false);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const activeRowRef = useRef<HTMLButtonElement>(null);
	const items = data?.items ?? [];
	const initialLoad = items.length === 0 && (isLoading || isFetching);

	trpc.navigation.onQueue.useSubscription(undefined, {
		onData: () => {
			setAtEnd(false);
			setPlayingIndex(null);
			void utils.navigation.queueList.invalidate();
		},
	});

	useEffect(() => {
		setPlayingIndex(null);
	}, [currentVideoId]);

	useLayoutEffect(() => {
		const row = activeRowRef.current;
		if (!row) return;
		const viewport = row.closest("[data-slot=scroll-area-viewport]");
		if (!(viewport instanceof HTMLElement)) return;
		const rowRect = row.getBoundingClientRect();
		const viewRect = viewport.getBoundingClientRect();
		if (rowRect.top < viewRect.top) viewport.scrollTop -= viewRect.top - rowRect.top;
		else if (rowRect.bottom > viewRect.bottom) viewport.scrollTop += rowRect.bottom - viewRect.bottom;
	}, [currentVideoId, playingIndex, items.length]);

	useEffect(() => {
		const el = sentinelRef.current;
		if (!el) return;
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting)) return;
				if (atEnd || fetchingRef.current || items.length === 0) return;
				fetchingRef.current = true;
				const prev = countRef.current;
				void refetch()
					.then((result) => {
						const nextCount = result.data?.count ?? prev;
						if (nextCount <= prev) setAtEnd(true);
					})
					.finally(() => {
						fetchingRef.current = false;
					});
			},
			{ root: el.closest("[data-slot=scroll-area-viewport]"), rootMargin: "48px", threshold: 0 },
		);
		io.observe(el);
		return () => io.disconnect();
	}, [atEnd, items.length, refetch]);

	async function playAt(index: number, videoId?: string) {
		setPlayingIndex(index);
		try {
			await queuePlay({ index, ...(videoId ? { videoId } : {}) });
		} catch {
			setPlayingIndex(null);
		}
	}

	return (
		<div className="relative z-10 flex min-h-0 w-full flex-1 flex-col">
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden border-border border-t bg-background/40 backdrop-blur-sm">
				<ScrollArea className="min-h-0 flex-1">
					{initialLoad ? (
						<ul className="flex flex-col gap-0.5 p-2" aria-busy="true" aria-label="Loading queue">
							<QueueItemSkeletons count={6} />
						</ul>
					) : items.length === 0 ? (
						<p className="px-3 py-6 text-center text-[11px] text-muted-foreground">
							{isError ? "Queue unavailable" : "Queue is empty"}
						</p>
					) : (
						<ul className="flex flex-col gap-0.5 p-2">
							{items.map((item) => {
								const current =
									playingIndex === item.index ||
									(playingIndex === null && !!item.videoId && item.videoId === currentVideoId);
								const thumb = toAppThumbUrl(item.thumbnail);
								return (
									<li key={`${item.index}-${item.videoId ?? "row"}`}>
										<button
											type="button"
											ref={current ? activeRowRef : undefined}
											aria-current={current ? "true" : undefined}
											className={cn(
												"flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left",
												"hover:bg-foreground/10",
												current && !accent && "bg-foreground/10",
											)}
											style={
												current && accent
													? {
															backgroundColor: `color-mix(in oklab, ${accent} 28%, transparent)`,
															color: accent,
														}
													: undefined
											}
											onClick={() => void playAt(item.index, item.videoId)}
										>
											<span className="relative size-7 shrink-0">
												{thumb ? (
													<img src={thumb} alt="" className="size-7 rounded object-cover" />
												) : (
													<span className="block size-7 rounded bg-muted/80" />
												)}
												{current ? <QueueEqBars paused={!playing} /> : null}
											</span>
											<span className="min-w-0 flex-1">
												<span className="block truncate text-[11px] leading-tight font-medium">
													{item.title ?? "Unknown"}
												</span>
												{item.artist ? (
													<span className="block truncate text-[10px] text-muted-foreground">{item.artist}</span>
												) : null}
											</span>
											{typeof item.durationSec === "number" && item.durationSec > 0 ? (
												<span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
													{formatQueueLength(item.durationSec)}
												</span>
											) : null}
										</button>
									</li>
								);
							})}
							{isFetching && !atEnd ? <QueueItemSkeletons count={3} /> : null}
						</ul>
					)}
					<div ref={sentinelRef} className="h-px" />
					{items.length > 0 && atEnd ? (
						<p className="px-3 py-2 text-center text-[10px] text-muted-foreground">End</p>
					) : null}
				</ScrollArea>
			</div>
		</div>
	);
}
