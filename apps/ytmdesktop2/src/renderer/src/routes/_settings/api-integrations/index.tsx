import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_settings/api-integrations/")({
	beforeLoad: () => {
		throw redirect({ to: "/api-integrations/api" });
	},
	component: () => null,
});
