import type { AppRouter } from "@main/trpc/router";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCReact } from "@trpc/react-query";
import { ipcLink } from "electron-trpc/renderer";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1_000,
			refetchOnWindowFocus: false,
			retry: false,
		},
	},
});

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
	links: [ipcLink()],
});

export type { AppRouter };
