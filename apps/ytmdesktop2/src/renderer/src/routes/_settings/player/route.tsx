import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_settings/player")({
	beforeLoad: ({ location }) => {
		if (location.pathname === "/player" || location.pathname === "/player/") {
			throw redirect({ to: "/player/general" });
		}
	},
	component: () => <Outlet />,
});
