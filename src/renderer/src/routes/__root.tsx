import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { queryClient, trpc, trpcClient } from "@/lib/trpc";

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	return (
		<trpc.Provider client={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>
				<Outlet />
				<Toaster />
			</QueryClientProvider>
		</trpc.Provider>
	);
}
