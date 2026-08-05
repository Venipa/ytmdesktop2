import { createFileRoute } from "@tanstack/react-router";
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
							Build the plugin with <span className="font-mono">pnpm streamdeck:pack</span>, then load it in Stream Deck.
						</li>
						<li>
							Add a YTMDesktop2 action → host <span className="font-mono">127.0.0.1</span>, port {port} → Authorize.
						</li>
						<li>Approve the code under Authentication.</li>
					</ol>
				</CardContent>
				<CardFooter>
					<a
						href="https://docs.elgato.com/streamdeck/sdk/introduction/getting-started/"
						target="_blank"
						rel="noreferrer"
						className="text-xs text-primary underline-offset-4 hover:underline"
					>
						Stream Deck plugin docs
					</a>
				</CardFooter>
			</Card>
		</>
	);
}
