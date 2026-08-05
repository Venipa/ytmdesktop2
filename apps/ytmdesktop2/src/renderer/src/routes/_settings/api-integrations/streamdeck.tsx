import {
	getStreamDeckDocsUrl,
	getStreamDeckReleasesUrl,
	resolveStreamDeckPluginDownloadUrl,
} from "@shared/utils/streamdeck-plugin";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

export const Route = createFileRoute("/_settings/api-integrations/streamdeck")({
	component: StreamDeckSettingsPage,
});

function StreamDeckSettingsPage() {
	const statusQuery = trpc.api.status.useQuery(undefined, { refetchInterval: 5_000 });
	const port = statusQuery.data?.port ?? 13091;
	const apiEnabled = statusQuery.data?.enabled === true;
	const docsUrl = getStreamDeckDocsUrl();
	const releasesUrl = getStreamDeckReleasesUrl();
	const [pluginUrl, setPluginUrl] = useState<string | null>(null);
	const [pluginUrlResolved, setPluginUrlResolved] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void resolveStreamDeckPluginDownloadUrl().then((url) => {
			if (cancelled) return;
			setPluginUrl(url);
			setPluginUrlResolved(true);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const downloadUrl = pluginUrl ?? docsUrl;

	return (
		<>
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						Stream Deck
						<Badge variant="outline">Integration</Badge>
					</CardTitle>
					<CardDescription>Control YouTube Music from an Elgato Stream Deck via the local API.</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
					<ol className="list-decimal space-y-2 pl-4">
						<li>
							Enable the API under <span className="font-medium text-foreground">API</span>
							{apiEnabled ? null : " (currently off)"}.
						</li>
						<li>
							Turn on <span className="font-medium text-foreground">Require authorization</span> under Authentication.
						</li>
						<li>
							Get the plugin from the{" "}
							<a href={docsUrl} target="_blank" rel="noreferrer" className="font-medium text-foreground underline-offset-4 hover:underline">
								website / docs
							</a>
							, download the <span className="font-mono">.streamDeckPlugin</span> file, then double-click / import it in Stream Deck.
						</li>
						<li>
							Add a YTMDesktop2 action → host <span className="font-mono">127.0.0.1</span>, port {port} → Authorize.
						</li>
						<li>Approve the code under Authentication.</li>
					</ol>
				</CardContent>
				<CardFooter className="flex flex-wrap gap-x-4 gap-y-2">
					<a href={docsUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline-offset-4 hover:underline">
						Open website
					</a>
					<a
						href={downloadUrl}
						target="_blank"
						rel="noreferrer"
						className="text-xs text-primary underline-offset-4 hover:underline"
					>
						{pluginUrlResolved && pluginUrl ? "Download plugin" : "Download from docs / releases"}
					</a>
					{!pluginUrl && pluginUrlResolved ? (
						<a
							href={releasesUrl}
							target="_blank"
							rel="noreferrer"
							className="text-xs text-muted-foreground underline-offset-4 hover:underline"
						>
							GitHub plugin release
						</a>
					) : null}
					<a
						href="https://docs.elgato.com/streamdeck/sdk/introduction/getting-started/"
						target="_blank"
						rel="noreferrer"
						className="text-xs text-muted-foreground underline-offset-4 hover:underline"
					>
						Stream Deck docs
					</a>
				</CardFooter>
			</Card>
		</>
	);
}
