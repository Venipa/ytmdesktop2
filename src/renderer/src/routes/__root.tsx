import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient, trpc, trpcClient } from "@/lib/trpc";

export const Route = createRootRoute({
	component: RootLayout,
});

function RootLayout() {
	return (
		<ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
			<trpc.Provider client={trpcClient} queryClient={queryClient}>
				<QueryClientProvider client={queryClient}>
					<TooltipProvider delay={0}>
						<Outlet />
						<Toaster theme="dark" />
					</TooltipProvider>
				</QueryClientProvider>
			</trpc.Provider>
		</ThemeProvider>
	);
}
