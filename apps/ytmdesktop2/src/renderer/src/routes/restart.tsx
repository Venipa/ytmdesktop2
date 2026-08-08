import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useWindowControls } from "@/hooks/use-window-controls";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangleIcon, CheckCircleIcon, InfoIcon, RefreshCwIcon, XCircleIcon } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/restart")({
	component: RestartPage,
});

const IconMap = {
	"check-circle": CheckCircleIcon,
	"x-circle": XCircleIcon,
	info: InfoIcon,
	warning: AlertTriangleIcon,
	error: XCircleIcon,
} as const;

const IconTone = {
	"check-circle": "bg-muted text-primary",
	"x-circle": "bg-destructive/15 text-destructive",
	info: "bg-muted text-primary",
	warning: "bg-amber-500/15 text-amber-500",
	error: "bg-destructive/15 text-destructive",
} as const;

function RestartPage() {
	const [isBusy, setIsBusy] = useState(false);
	const params = new URLSearchParams(location.href.slice(location.href.indexOf("?")));
	const meta = {
		message: params.get("message") ?? "Please restart the application to apply pending changes.",
		icon: (params.get("icon") ?? "info") as keyof typeof IconMap,
	};
	const IconComponent = IconMap[meta.icon] ?? InfoIcon;
	const tone = IconTone[meta.icon] ?? IconTone.info;
	const { dialogResponse } = useWindowControls();

	function action(next: "close" | "ok") {
		if (isBusy) return;
		setIsBusy(true);
		void dialogResponse(next);
		setTimeout(() => setIsBusy(false), 1000);
	}

	return (
		<div className="drag flex h-full min-h-screen flex-col bg-background p-5 justify-between gap-6">
			<div className="flex gap-3">
				<div className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", tone)}>
					<IconComponent className="size-4" />
				</div>
				<div className="flex min-w-0 flex-col gap-1">
					<h2 className="text-sm font-medium leading-snug">Restart required</h2>
					<p className="text-xs leading-relaxed text-muted-foreground text-pretty">{meta.message}</p>
				</div>
			</div>

			<div className="no-drag mt-5 flex flex-col gap-2">
				<Button variant="accent" size="xl" className="w-full" disabled={isBusy} onClick={() => action("ok")}>
					{isBusy ? <Spinner size="sm" /> : <RefreshCwIcon />}
					Restart now
				</Button>
				<Button variant="outline" className="w-full" disabled={isBusy} onClick={() => action("close")}>
					Later
				</Button>
			</div>
		</div>
	);
}
