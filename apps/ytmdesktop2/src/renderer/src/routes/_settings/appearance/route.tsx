import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_settings/appearance")({
	beforeLoad: ({ location }) => {
		if (location.pathname === "/appearance" || location.pathname === "/appearance/") {
			throw redirect({ to: "/appearance/themes" });
		}
	},
	component: () => <Outlet />,
});
