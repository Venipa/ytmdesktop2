import { Button } from "@/components/ui/button";
import { useWindowControls } from "@/hooks/use-window-controls";
import { createFileRoute } from "@tanstack/react-router";
import { ListPlusIcon, PlayIcon, XIcon } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/deeplink")({
	component: DeeplinkPage,
});

function DeeplinkPage() {
	const [busy, setBusy] = useState(false);
	const params = new URLSearchParams(location.href.slice(location.href.indexOf("?")));
	const videoId = params.get("videoId") ?? "";
	const playlistId = params.get("playlistId");
	const shareUrl = params.get("url") ?? (videoId ? `ytmd://watch/${videoId}` : "ytmd://");
	const { dialogResponse } = useWindowControls();

	function choose(action: "play" | "queue" | "close") {
		if (busy) return;
		setBusy(true);
		void dialogResponse(action);
		setTimeout(() => setBusy(false), 800);
	}

	return (
		<div className="drag flex h-full min-h-screen flex-col justify-between gap-5 bg-background p-5">
			<div className="flex min-w-0 flex-col gap-2">
				<h2 className="text-sm font-medium leading-snug">Open shared link?</h2>
				<p className="text-xs leading-relaxed text-muted-foreground text-pretty">
					Choose how to open this YouTube Music link in the app.
				</p>
				<code className="mt-1 block truncate rounded-md bg-muted/60 px-2 py-1.5 font-mono text-[11px] text-foreground/90">
					{shareUrl}
				</code>
				{playlistId ? (
					<p className="text-[11px] text-muted-foreground">Includes playlist context</p>
				) : null}
			</div>

			<div className="no-drag flex flex-col gap-2">
				<Button variant="accent" size="xl" className="w-full" disabled={busy || !videoId} onClick={() => choose("play")}>
					<PlayIcon />
					Play now
				</Button>
				<Button variant="outline" size="xl" className="w-full" disabled={busy || !videoId} onClick={() => choose("queue")}>
					<ListPlusIcon />
					Add to queue
				</Button>
				<Button variant="ghost" className="w-full" disabled={busy} onClick={() => choose("close")}>
					<XIcon />
					Cancel
				</Button>
			</div>
		</div>
	);
}
