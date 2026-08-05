import { createFileRoute, redirect } from "@tanstack/react-router";

/** Moved out of API & Integrations — Last.fm does not use the local API. */
export const Route = createFileRoute("/_settings/api-integrations/lastfm")({
	beforeLoad: () => {
		throw redirect({ to: "/lastfm" });
	},
	component: () => null,
});
