import { Volume1Icon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { type PointerEvent, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type TrayVolumeControlProps = {
	accent: string | null;
	disabled?: boolean;
};

export function TrayVolumeControl({ accent, disabled }: TrayVolumeControlProps) {
	const { mutateAsync: setVolume } = trpc.track.volume.useMutation();
	const [volume, setVolumeState] = useState(100);
	const rootRef = useRef<HTMLDivElement>(null);
	const draggingRef = useRef(false);
	const loadedRef = useRef(false);
	const lastHeardRef = useRef(100);
	const trackRef = useRef<HTMLDivElement>(null);

	function ensureVolume() {
		if (loadedRef.current) return;
		loadedRef.current = true;
		void setVolume({})
			.then((next) => {
				if (typeof next?.volume !== "number") return;
				setVolumeState(next.volume);
				if (next.volume > 0) lastHeardRef.current = next.volume;
			})
			.catch(() => {
				loadedRef.current = false;
			});
	}

	function commit(next: number) {
		const clamped = Math.max(0, Math.min(100, Math.round(next)));
		setVolumeState(clamped);
		if (clamped > 0) lastHeardRef.current = clamped;
		void setVolume({ volume: clamped }).catch(() => {});
	}

	function onScrub(clientX: number) {
		const el = trackRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		if (rect.width <= 0) return;
		commit(((clientX - rect.left) / rect.width) * 100);
	}

	function setDragging(on: boolean) {
		draggingRef.current = on;
		rootRef.current?.toggleAttribute("data-dragging", on);
	}

	function onPointerDown(ev: PointerEvent<HTMLDivElement>) {
		setDragging(true);
		ev.currentTarget.setPointerCapture(ev.pointerId);
		onScrub(ev.clientX);
	}

	function onPointerMove(ev: PointerEvent<HTMLDivElement>) {
		if (!draggingRef.current) return;
		onScrub(ev.clientX);
	}

	function onPointerUp(ev: PointerEvent<HTMLDivElement>) {
		setDragging(false);
		if (ev.currentTarget.hasPointerCapture(ev.pointerId)) {
			ev.currentTarget.releasePointerCapture(ev.pointerId);
		}
	}

	const muted = volume <= 0;
	const Icon = muted ? VolumeXIcon : volume < 50 ? Volume1Icon : Volume2Icon;

	return (
		<div
			ref={rootRef}
			className={cn(
				"group/vol flex h-8 items-center rounded-full",
				"transition-colors duration-100 hover:bg-foreground/10",
				"focus-within:bg-foreground/10 data-[dragging=true]:bg-foreground/10",
				disabled && "pointer-events-none opacity-50",
			)}
			onPointerEnter={ensureVolume}
			onFocusCapture={ensureVolume}
		>
			<button
				type="button"
				disabled={disabled}
				aria-label={muted ? "Unmute" : "Mute"}
				aria-pressed={muted}
				className={cn(
					"inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground",
					"transition-transform duration-100 enabled:active:scale-95",
					"[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
				)}
				onClick={() => commit(muted ? lastHeardRef.current : 0)}
			>
				<Icon />
			</button>
			<div
				className={cn(
					"w-0 overflow-hidden pr-0 opacity-0 transition-[width,opacity,padding] duration-200 ease-out",
					"group-hover/vol:w-[4.5rem] group-hover/vol:pr-2 group-hover/vol:opacity-100",
					"group-focus-within/vol:w-[4.5rem] group-focus-within/vol:pr-2 group-focus-within/vol:opacity-100",
					"group-data-[dragging=true]/vol:w-[4.5rem] group-data-[dragging=true]/vol:pr-2 group-data-[dragging=true]/vol:opacity-100",
				)}
			>
				<div
					ref={trackRef}
					className="relative h-5 w-16 cursor-pointer"
					role="slider"
					aria-label="Volume"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.round(volume)}
					tabIndex={disabled ? -1 : 0}
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerUp}
				>
					<span className="absolute top-1/2 right-0 left-0 h-1 -translate-y-1/2 rounded-full bg-foreground/15" />
					<span
						className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-accent"
						style={{
							width: `${volume}%`,
							...(accent ? { backgroundColor: accent } : {}),
						}}
					/>
					<span
						className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-sm ring-2 ring-background"
						style={{ left: `${volume}%` }}
					/>
				</div>
			</div>
		</div>
	);
}
