import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy Integrations path → Last.fm. */
export const Route = createFileRoute("/_settings/integrations")({
	beforeLoad: () => {
		throw redirect({ to: "/lastfm" });
	},
	component: () => null,
});
