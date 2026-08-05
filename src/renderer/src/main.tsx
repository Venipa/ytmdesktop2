import { Logger } from "@shared/utils/console";
import { createHashHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import "non.geist";
import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { SpinnerPage } from "@/components/ui/spinner";
import { routeTree } from "./routeTree.gen";
import "./styles/globals.css";

if (import.meta.env.PROD) Logger.enableProductionMode();

const history = createHashHistory();
const router = createRouter({
	routeTree,
	history,
	defaultPreload: false,
	// Show pending immediately — Infinity kept previous route painted while lazy chunk loads
	defaultPendingMs: 0,
	defaultPendingMinMs: 0,
	defaultPendingComponent: SpinnerPage,
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
		<Suspense fallback={<SpinnerPage />}>
			<RouterProvider router={router} />
		</Suspense>
	</StrictMode>,
);
