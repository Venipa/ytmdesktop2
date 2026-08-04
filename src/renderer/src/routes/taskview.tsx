import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import ExitIcon from "@/assets/icons/close.svg?react";
import SettingsIcon from "@/assets/icons/settings.svg?react";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/taskview")({
	component: TaskViewPage,
});

function TaskViewPage() {
	const [showWinBorder, setShowWinBorder] = useState(false);
	const accentColor = "#a0a0a0";
	const { data: isWin11 } = trpc.app.isWin11.useQuery();
	const { mutateAsync: openWindow } = trpc.app.openWindow.useMutation();
	const { mutateAsync: quit } = trpc.app.quit.useMutation();

	useEffect(() => {
		document.title = "YouTube Music - Task View";
	}, []);

	useEffect(() => {
		if (isWin11 === undefined) return;
		setShowWinBorder(window.app.platform === "win32" ? !isWin11 : false);
	}, [isWin11]);

	return (
		<div
			className="absolute inset-0 flex h-full flex-col overflow-hidden bg-black"
			style={accentColor && showWinBorder ? { border: `1px solid ${accentColor}` } : undefined}
		>
			<div className="flex h-10 items-stretch justify-between border-b border-gray-600 bg-black px-2 select-none">
				<div className="flex flex-auto items-center px-2">
					<div className="text-sm">{window.translations?.appName ?? "YouTube Music"}</div>
				</div>
				<div className="flex flex-shrink-0 items-center gap-2">
					<div className="h-6 w-px bg-gray-600" />
					<button type="button" className="control-button" onClick={() => void openWindow("settingsWindow")}>
						<SettingsIcon />
					</button>
				</div>
			</div>
			<div className="overflow-x-hidden overflow-y-auto">
				<div className="mx-2 mt-2 mb-6 flex flex-col gap-2">
					<button type="button" className="task-menu-item">
						Test
					</button>
					<button type="button" className="task-menu-item">
						Test
					</button>
					<button type="button" className="task-menu-item">
						Test
					</button>
					<button type="button" className="task-menu-item flex items-center gap-2" onClick={() => void quit(true)}>
						<ExitIcon className="size-4" />
						<span>Exit App</span>
					</button>
				</div>
			</div>
			<style>{`
.task-menu-item {
  min-height: 40px;
  padding: 0 12px;
  cursor: pointer;
  background: rgb(24 24 27 / 0.6);
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  transition: transform 0.15s;
  user-select: none;
}
.task-menu-item:hover, .task-menu-item:active { background: rgb(24 24 27 / 0.8); }
.task-menu-item:active { transform: scale(0.98); }
`}</style>
		</div>
	);
}
