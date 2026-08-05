import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy path → Stream Deck under API & Integrations. */
export const Route = createFileRoute("/_settings/streamdeck")({
	beforeLoad: () => {
		throw redirect({ to: "/api-integrations/streamdeck" });
	},
	component: () => null,
});
