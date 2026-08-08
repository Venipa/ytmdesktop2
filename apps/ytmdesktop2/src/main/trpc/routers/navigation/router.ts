import { fromIpcEvent } from "@main/trpc/fromIpcEvent";
import { provider } from "@main/trpc/provider";
import { publicProcedure, router } from "@shared/trpc/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const watchInput = z.object({
	videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/, "invalid videoId"),
	playlistId: z.string().min(1).optional(),
});

const playlistInput = z.object({
	playlistId: z.string().min(1).regex(/^[A-Za-z0-9_-]{2,128}$/, "invalid playlistId"),
	play: z.boolean().optional(),
});

const channelInput = z
	.object({
		channelId: z.string().min(1).optional(),
		handle: z.string().min(1).optional(),
	})
	.refine((v) => Boolean(v.channelId?.trim() || v.handle?.trim()), {
		message: "channelId or handle required",
	});

const queueInput = z
	.object({
		videoId: z.string().min(1).optional(),
		playlistId: z.string().min(1).optional(),
	})
	.refine((v) => Boolean(v.videoId?.trim() || v.playlistId?.trim()), {
		message: "videoId or playlistId required",
	});

const openInput = z.object({
	url: z.string().min(1),
});

export const navigationRouter = router({
	home: publicProcedure.mutation(async ({ ctx }) => {
		await provider(ctx, "navigation").goHome();
		return { ok: true as const };
	}),
	goback: publicProcedure.mutation(({ ctx }): void => {
		const contents = provider(ctx, "window").views.youtubeView?.webContents;
		if (!contents || contents.isDestroyed() || !contents.navigationHistory.canGoBack()) return;
		contents.navigationHistory.goBack();
	}),
	devTools: publicProcedure.mutation(({ ctx }): void => provider(ctx, "navigation").toggleDevTools()),
	/**
	 * Open ytmd:// or https music|youtube|youtu.be URL immediately (no ask dialog).
	 */
	open: publicProcedure.input(openInput).mutation(async ({ ctx, input }) => {
		try {
			return await provider(ctx, "navigation").openUrl(input.url);
		} catch (err) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: err instanceof Error ? err.message : "unsupported or invalid url",
			});
		}
	}),
	/** Play song (strips radio/mix playlist ids). Immediate — no deeplink dialog. */
	watch: publicProcedure.input(watchInput).mutation(async ({ ctx, input }) => {
		await provider(ctx, "navigation").openWatch(input.videoId, input.playlistId);
		return { ok: true as const };
	}),
	/** Open playlist page, or start playing when `play` is true. */
	playlist: publicProcedure.input(playlistInput).mutation(async ({ ctx, input }) => {
		await provider(ctx, "navigation").openPlaylist(input.playlistId, input.play ?? false);
		return { ok: true as const };
	}),
	/** Open artist/channel by UC id and/or @handle. */
	channel: publicProcedure.input(channelInput).mutation(async ({ ctx, input }) => {
		await provider(ctx, "navigation").openChannel({
			channelId: input.channelId,
			handle: input.handle,
		});
		return { ok: true as const };
	}),
	/**
	 * Append video **or** playlist to queue (XOR).
	 * If both sent, videoId wins and playlistId is dropped.
	 */
	queue: publicProcedure.input(queueInput).mutation(async ({ ctx, input }) => {
		const videoId = input.videoId?.trim() || undefined;
		const playlistId = input.playlistId?.trim() || undefined;
		if (!videoId && !playlistId) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "videoId or playlistId required" });
		}
		await provider(ctx, "navigation").queueAdd(videoId, playlistId);
		return { ok: true as const };
	}),
	queueList: publicProcedure.query(async ({ ctx }) => provider(ctx, "navigation").queueList()),
	queueClear: publicProcedure.mutation(async ({ ctx }) => provider(ctx, "navigation").queueClear()),
	onSameOrigin: publicProcedure.subscription(() => fromIpcEvent<boolean>("nav.same-origin")),
});
