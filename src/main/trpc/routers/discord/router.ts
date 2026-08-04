import { fromIpcEvent } from "@main/trpc/fromIpcEvent";
import { provider } from "@shared/trpc/context";
import { publicProcedure, router } from "@shared/trpc/trpc";

export const discordRouter = router({
	connected: publicProcedure.query(({ ctx }) => provider(ctx, "discord").getConnectedState()),
	onConnected: publicProcedure.subscription(() => fromIpcEvent("discord.connected", () => true as const)),
	onDisconnected: publicProcedure.subscription(() => fromIpcEvent("discord.disconnected", () => false as const)),
	onLoading: publicProcedure.subscription(() => fromIpcEvent("discord.loading", () => true as const)),
	onError: publicProcedure.subscription(() => fromIpcEvent<string | null>("discord.error")),
});
