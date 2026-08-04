import { Logger } from "@shared/utils/console";
import { createHashHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import "non.geist";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { routeTree } from "./routeTree.gen";
import "./styles/globals.css";

if (import.meta.env.PROD) Logger.enableProductionMode();

const history = createHashHistory();
const router = createRouter({
	routeTree,
	history,
	// Instant hash nav — no pending UI flash between settings tabs
	defaultPreload: false,
	defaultPendingMs: Number.POSITIVE_INFINITY,
	defaultPendingMinMs: 0,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const rootEl = document.getElementById("app");
if (!rootEl) throw new Error("#app root missing");

createRoot(rootEl).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>,
);
