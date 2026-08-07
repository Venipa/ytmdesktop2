import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_settings/appearance/")({
	beforeLoad: () => {
		throw redirect({ to: "/appearance/themes" });
	},
	component: () => null,
});
