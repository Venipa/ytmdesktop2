import type { ApiClientRecord, PendingAuthRequest } from "@main/api/auth";
import { provider } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";
import { observable } from "@trpc/server/observable";
import { z } from "zod";

type SafeClient = Omit<ApiClientRecord, "token">;

function toSafeClient(client: ApiClientRecord): SafeClient {
	const { token: _token, ...rest } = client;
	return rest;
}

export const apiRouter = router({
	status: publicProcedure.query(({ ctx }) => {
		const api = provider(ctx, "api");
		const settings = provider(ctx, "settings").instance.api;
		return {
			enabled: settings?.enabled === true,
			port: settings?.port ?? 13091,
			authRequired: settings?.authRequired === true,
			running: api.isInitialized,
			pending: api.getPendingAuth(),
			clients: api.getClients().map(toSafeClient),
		};
	}),
	pending: publicProcedure.query(({ ctx }) => provider(ctx, "api").getPendingAuth()),
	clients: publicProcedure.query(({ ctx }) => provider(ctx, "api").getClients().map(toSafeClient)),
	approve: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
		const client = provider(ctx, "api").approveAuth(input.id);
		return client ? toSafeClient(client) : null;
	}),
	deny: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => provider(ctx, "api").denyAuth(input.id)),
	revoke: publicProcedure.input(z.object({ appId: z.string() })).mutation(({ ctx, input }) => provider(ctx, "api").revokeClient(input.appId)),
	revokeAll: publicProcedure.mutation(({ ctx }) => {
		provider(ctx, "api").revokeAllClients();
		return true;
	}),
	onPending: publicProcedure.subscription(({ ctx }) => {
		const api = provider(ctx, "api");
		return observable<PendingAuthRequest | null>((emit) => {
			const sub = api.pendingAuth$.subscribe((value) => emit.next(value));
			emit.next(api.getPendingAuth()[0] ?? null);
			return () => sub.unsubscribe();
		});
	}),
	onClients: publicProcedure.subscription(({ ctx }) => {
		const api = provider(ctx, "api");
		return observable<SafeClient[]>((emit) => {
			const sub = api.clients$.subscribe((clients) => emit.next(clients.map(toSafeClient)));
			emit.next(api.getClients().map(toSafeClient));
			return () => sub.unsubscribe();
		});
	}),
});
