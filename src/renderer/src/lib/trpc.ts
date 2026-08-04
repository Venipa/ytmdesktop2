import type { AppRouter } from "@shared/trpc/router";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCProxyClient } from "@trpc/client";
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

/** Vanilla client for non-React call sites / fire-and-forget. */
export const trpcProxy = createTRPCProxyClient<AppRouter>({
	links: [ipcLink()],
});

export type { AppRouter };
