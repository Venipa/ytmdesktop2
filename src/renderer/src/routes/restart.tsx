import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangleIcon, CheckCircleIcon, InfoIcon, XCircleIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

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

function RestartPage() {
	const [isBusy, setIsBusy] = useState(false);
	const meta = useMemo(() => {
		const params = new URLSearchParams(location.href.slice(location.href.indexOf("?")));
		return {
			message: params.get("message") ?? "Please restart the application to apply pending changes.",
			icon: params.get("icon") ?? "info",
		};
	}, []);
	const IconComponent = IconMap[meta.icon as keyof typeof IconMap] ?? null;

	function action(next: "close" | "ok") {
		setIsBusy(true);
		window.api.send("window.response", { action: next });
		setTimeout(() => setIsBusy(false), 1000);
	}

	return (
		<div className="flex h-full min-h-screen flex-col overflow-hidden bg-black p-4">
			<div className="mb-6 flex flex-grow flex-col items-center justify-center gap-4 px-6 py-4 text-center">
				{IconComponent && <IconComponent size={40} className="text-white" />}
				<h2 className="text-xl font-semibold text-white">Restart Required</h2>
				<p className="text-sm text-gray-400">{meta.message}</p>
			</div>
			<div className="flex gap-3 pt-2">
				<Button variant="outline" className="flex-1" disabled={isBusy} onClick={() => action("close")}>
					Later
				</Button>
				<Button className="w-full" disabled={isBusy} onClick={() => action("ok")}>
					Restart
				</Button>
			</div>
		</div>
	);
}
