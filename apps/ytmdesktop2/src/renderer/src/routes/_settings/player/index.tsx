import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_settings/player/")({
	beforeLoad: () => {
		throw redirect({ to: "/player/general" });
	},
	component: () => null,
});
