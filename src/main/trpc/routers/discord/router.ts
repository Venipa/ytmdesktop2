import { fromIpcEvent } from "@main/trpc/fromIpcEvent";
import { provider } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";

type DiscordSvc = { getConnectedState(): boolean };

export const discordRouter = router({
	connected: publicProcedure.query(({ ctx }): boolean => provider<DiscordSvc>(ctx, "discord").getConnectedState()),
	onConnected: publicProcedure.subscription(() => fromIpcEvent("discord.connected", () => true as const)),
	onDisconnected: publicProcedure.subscription(() => fromIpcEvent("discord.disconnected", () => false as const)),
	onLoading: publicProcedure.subscription(() => fromIpcEvent("discord.loading", () => true as const)),
	onError: publicProcedure.subscription(() => fromIpcEvent<string | null>("discord.error")),
});
