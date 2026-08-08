import { Button } from "@/components/ui/button";
import { useWindowControls } from "@/hooks/use-window-controls";
import { createFileRoute } from "@tanstack/react-router";
import { ListMusicIcon, ListPlusIcon, PlayIcon, UserIcon, XIcon } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/deeplink")({
	component: DeeplinkPage,
});

type LinkKind = "watch" | "playlist" | "channel";

function DeeplinkPage() {
	const [busy, setBusy] = useState(false);
	const params = new URLSearchParams(location.href.slice(location.href.indexOf("?")));
	const kind = (params.get("kind") as LinkKind | null) ?? "watch";
	const videoId = params.get("videoId") ?? "";
	const playlistId = params.get("playlistId");
	const channelId = params.get("channelId");
	const handle = params.get("handle");
	const shareUrl = params.get("url") ?? "ytmd://";
	const { dialogResponse } = useWindowControls();

	function choose(action: "play" | "queue" | "open" | "close") {
		if (busy) return;
		setBusy(true);
		void dialogResponse(action);
		setTimeout(() => setBusy(false), 800);
	}

	const title =
		kind === "playlist" ? "Open playlist?" : kind === "channel" ? "Open channel?" : "Open shared link?";
	const blurb =
		kind === "playlist"
			? "Play now, add the playlist to your queue, or open the playlist page."
			: kind === "channel"
				? "Open this artist or channel page in the app."
				: "Choose how to open this YouTube Music link in the app.";

	const canWatch = kind === "watch" && !!videoId;
	const canPlaylist = kind === "playlist" && !!playlistId;
	const canChannel = kind === "channel" && !!(channelId || handle);

	return (
		<div className="drag flex h-full min-h-screen flex-col justify-between gap-5 bg-background p-5">
			<div className="flex min-w-0 flex-col gap-2">
				<h2 className="text-sm font-medium leading-snug">{title}</h2>
				<p className="text-xs leading-relaxed text-muted-foreground text-pretty">{blurb}</p>
				<code className="mt-1 block truncate rounded-md bg-muted/60 px-2 py-1.5 font-mono text-[11px] text-foreground/90">
					{shareUrl}
				</code>
				{kind === "watch" && playlistId ? (
					<p className="text-[11px] text-muted-foreground">Includes playlist context</p>
				) : null}
				{kind === "channel" && handle ? (
					<p className="text-[11px] text-muted-foreground">@{handle}</p>
				) : null}
			</div>

			<div className="no-drag flex flex-col gap-2">
				{kind === "watch" ? (
					<>
						<Button variant="accent" size="xl" className="w-full" disabled={busy || !canWatch} onClick={() => choose("play")}>
							<PlayIcon />
							Play now
						</Button>
						<Button variant="outline" size="xl" className="w-full" disabled={busy || !canWatch} onClick={() => choose("queue")}>
							<ListPlusIcon />
							Add to queue
						</Button>
					</>
				) : null}

				{kind === "playlist" ? (
					<>
						<Button variant="accent" size="xl" className="w-full" disabled={busy || !canPlaylist} onClick={() => choose("play")}>
							<PlayIcon />
							Play playlist
						</Button>
						<Button variant="outline" size="xl" className="w-full" disabled={busy || !canPlaylist} onClick={() => choose("queue")}>
							<ListPlusIcon />
							Add to queue
						</Button>
						<Button variant="outline" size="xl" className="w-full" disabled={busy || !canPlaylist} onClick={() => choose("open")}>
							<ListMusicIcon />
							Open playlist
						</Button>
					</>
				) : null}

				{kind === "channel" ? (
					<Button variant="accent" size="xl" className="w-full" disabled={busy || !canChannel} onClick={() => choose("open")}>
						<UserIcon />
						Open channel
					</Button>
				) : null}

				<Button variant="ghost" className="w-full" disabled={busy} onClick={() => choose("close")}>
					<XIcon />
					Cancel
				</Button>
			</div>
		</div>
	);
}
