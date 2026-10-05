// @ts-nocheck — tRPC 10 + TS 5.x nested CreateRouterInner assignability false positive.
// `export type AppRouter = typeof appRouter` still infers full procedure I/O (not any).

import { apiRouter } from "@main/trpc/routers/api";
import { appServiceRouter } from "@main/trpc/routers/app";
import { authRouter } from "@main/trpc/routers/auth";
import { chromecastRouter } from "@main/trpc/routers/chromecast";
import { discordRouter } from "@main/trpc/routers/discord";
import { lastfmRouter } from "@main/trpc/routers/lastfm";
import { lyricsRouter } from "@main/trpc/routers/lyrics";
import { navigationRouter } from "@main/trpc/routers/navigation";
import { settingsRouter } from "@main/trpc/routers/settings";
import { themesRouter } from "@main/trpc/routers/themes";
import { trackRouter } from "@main/trpc/routers/track";
import { trayRouter } from "@main/trpc/routers/tray";
import { trayViewRouter } from "@main/trpc/routers/trayView";
import { updateRouter } from "@main/trpc/routers/update";
import { windowRouter } from "@main/trpc/routers/window";
import { router } from "@shared/trpc/trpc";

/**
 * Child routers (tRPC v10 docs):
 * https://trpc.io/docs/v10/server/merging-routers
 * Paths flatten to `track.current`, `settings.get`, …
 */
export const appRouter = router({
	track: trackRouter,
	settings: settingsRouter,
	app: appServiceRouter,
	api: apiRouter,
	auth: authRouter,
	update: updateRouter,
	navigation: navigationRouter,
	tray: trayRouter,
	trayView: trayViewRouter,
	themes: themesRouter,
	lastfm: lastfmRouter,
	lyrics: lyricsRouter,
	chromecast: chromecastRouter,
	window: windowRouter,
	discord: discordRouter,
});

export type AppRouter = typeof appRouter;
