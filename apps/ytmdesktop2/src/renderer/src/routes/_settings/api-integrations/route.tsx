import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SpinnerPage } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_settings/api-integrations")({
	beforeLoad: ({ location }) => {
		if (location.pathname === "/api-integrations" || location.pathname === "/api-integrations/") {
			throw redirect({ to: "/api-integrations/api" });
		}
	},
	component: ApiIntegrationsLayout,
});

function ApiIntegrationsLayout() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	return (
		<div className="flex h-full min-h-0 flex-col">
			<ScrollArea className="min-h-0 flex-1">
				<div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 pb-8">
					<Suspense key={pathname} fallback={<SpinnerPage />}>
						<Outlet />
					</Suspense>
				</div>
			</ScrollArea>
			<ApiIntegrationsStatusBar />
		</div>
	);
}

function StatusDot({ active, className }: { active: boolean; className?: string }) {
	return (
		<span
			aria-hidden
			className={cn(
				"size-1.5 shrink-0 rounded-full",
				active ? "bg-emerald-500" : "bg-muted-foreground/40",
				className,
			)}
		/>
	);
}

function ApiIntegrationsStatusBar() {
	const statusQuery = trpc.api.status.useQuery(undefined, { refetchInterval: 5_000 });
	const enabled = statusQuery.data?.enabled === true;
	const running = statusQuery.data?.running === true;
	const authRequired = statusQuery.data?.authRequired === true;
	const port = statusQuery.data?.port ?? 13091;

	const serverLabel = !enabled ? "Disabled" : running ? "Running" : "Stopped";
	const serverActive = enabled && running;

	return (
		<div className="shrink-0 border-t border-border bg-background/80 px-4 py-2 backdrop-blur-sm">
			<div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
				<div className="flex items-center gap-2">
					<span className="font-medium text-foreground/80">API</span>
					<StatusDot active={serverActive} />
					<Badge variant={serverActive ? "default" : "secondary"}>{serverLabel}</Badge>
					{enabled && <span className="font-mono text-[11px]">127.0.0.1:{port}</span>}
				</div>
				<span className="hidden h-3 w-px bg-border sm:block" aria-hidden />
				<div className="flex items-center gap-2">
					<span className="font-medium text-foreground/80">Auth</span>
					<StatusDot active={authRequired} />
					<Badge variant={authRequired ? "default" : "secondary"}>{authRequired ? "Active" : "Off"}</Badge>
				</div>
			</div>
		</div>
	);
}
