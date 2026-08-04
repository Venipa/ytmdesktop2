import type { ReactNode } from "react";
import CloseIcon from "@/assets/icons/close.svg?react";
import MaxIcon from "@/assets/icons/max-window.svg?react";
import MinIcon from "@/assets/icons/min-window.svg?react";
import { useWindowState } from "@/hooks/use-settings";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type ControlType = "close" | "maximize" | "minimize";

export interface ControlBarProps {
	title?: string;
	controls?: ControlType[];
	icon?: ReactNode;
	divider?: ReactNode;
	className?: string;
}

export function ControlBar({ title, controls, icon, divider, className }: ControlBarProps) {
	const [state] = useWindowState();
	const minimize = trpc.app.minimize.useMutation();
	const maximize = trpc.app.maximize.useMutation();
	const isMac = window.process.platform === "darwin";
	const showClose = !controls || controls.includes("close");

	return (
		<div className={cn("flex h-10 items-stretch justify-between border-b border-gray-600 bg-black px-2 select-none", className)}>
			<div className="drag flex flex-1 items-center">
				<div className="mr-2 size-4 text-gray-50">
					{icon ?? (
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
							<path
								fillRule="evenodd"
								d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
								clipRule="evenodd"
							/>
						</svg>
					)}
				</div>
				<p className="text-xs">{title}</p>
			</div>
			<div className="flex items-center gap-2">
				{divider ?? <div className="h-6 w-px bg-gray-50/10" />}
				<div className="flex items-center gap-1">
					{!isMac && (
						<>
							{state?.minimizable && (
								<button type="button" className="control-button" onClick={() => minimize.mutate()}>
									<MinIcon />
								</button>
							)}
							{state?.maximizable && (
								<button type="button" className="control-button" onClick={() => maximize.mutate()}>
									<MaxIcon />
								</button>
							)}
						</>
					)}
					{showClose && (
						<button type="button" className="control-button control-button-danger" onClick={() => window.api.closeWindow()}>
							<CloseIcon />
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
