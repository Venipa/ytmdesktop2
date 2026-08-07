// @ts-nocheck — web-only AppRouter shim for renderer typecheck; not used at runtime.
/**
 * Web typecheck shim — real AppRouter lives in `@main/trpc/router` (node).
 * Procedure names must stay in sync so renderer hooks typecheck.
 */
import { publicProcedure, router } from "@shared/trpc/trpc";
import { observable } from "@trpc/server/observable";
import { z } from "zod";

const emptySub = <T>() => observable<T>(() => () => undefined);

const trackRouter = router({
	current: publicProcedure.query((): any => null),
	state: publicProcedure.query((): any => null),
	accent: publicProcedure.query((): any => null),
	routes: publicProcedure.query((): any => []),
	like: publicProcedure.input(z.object({ liked: z.boolean() })).mutation((): any => null),
	dislike: publicProcedure.input(z.object({ disliked: z.boolean() })).mutation((): any => null),
	next: publicProcedure.mutation((): any => null),
	prev: publicProcedure.mutation((): any => null),
	play: publicProcedure.mutation((): any => null),
	pause: publicProcedure.mutation((): any => null),
	togglePlay: publicProcedure.mutation((): any => null),
	repeat: publicProcedure.mutation((): any => null),
	shuffle: publicProcedure.mutation((): any => null),
	volume: publicProcedure.input(z.object({ volume: z.number().optional() }).optional()).mutation((): any => null),
	volumeUp: publicProcedure.input(z.object({ amount: z.number().optional() }).optional()).mutation((): any => null),
	volumeDown: publicProcedure.input(z.object({ amount: z.number().optional() }).optional()).mutation((): any => null),
	forward: publicProcedure.input(z.object({ time: z.number() })).mutation((): any => null),
	backward: publicProcedure.input(z.object({ time: z.number() })).mutation((): any => null),
	seek: publicProcedure.input(z.object({ time: z.number(), type: z.enum(["seek"]).optional() })).mutation((): any => null),
	onTrack: publicProcedure.subscription(() => emptySub<any>()),
	onPlayState: publicProcedure.subscription(() => emptySub<any>()),
});

const settingsRouter = router({
	get: publicProcedure.input(z.object({ key: z.string(), defaultValue: z.unknown().optional() })).query((): any => null),
	getAll: publicProcedure.input(z.unknown().optional()).query((): any => null),
	update: publicProcedure.input(z.object({ key: z.string(), value: z.unknown() })).mutation(({ input }): any => input.value),
	set: publicProcedure.input(z.object({ key: z.string(), value: z.unknown() })).mutation((): any => undefined),
	onChange: publicProcedure.subscription(() => emptySub<{ key: string; value: any; prevValue: any }>()),
});

const appServiceRouter = router({
	isWin11: publicProcedure.query((): any => false),
	version: publicProcedure.query((): string => ""),
	openFile: publicProcedure.input(z.string()).mutation((): any => undefined),
	minimize: publicProcedure.mutation((): any => undefined),
	maximize: publicProcedure.mutation((): any => undefined),
	quit: publicProcedure.input(z.boolean().optional()).mutation((): any => undefined),
	openWindow: publicProcedure.input(z.string()).mutation((): any => undefined),
	openSettings: publicProcedure.mutation((): any => undefined),
	closeWindow: publicProcedure.input(z.string().optional()).mutation((): any => undefined),
	restartNeeded: publicProcedure
		.input(z.object({ message: z.string().optional(), icon: z.string().optional() }).optional())
		.mutation((): any => undefined),
});

const apiRouter = router({
	status: publicProcedure.query((): any => null),
});

const authRouter = router({
	status: publicProcedure.query((): any => null),
	pending: publicProcedure.query((): any => []),
	clients: publicProcedure.query((): any => []),
	approve: publicProcedure.input(z.object({ id: z.string() })).mutation((): any => null),
	deny: publicProcedure.input(z.object({ id: z.string() })).mutation((): any => false),
	revoke: publicProcedure.input(z.object({ appId: z.string() })).mutation((): any => false),
	revokeAll: publicProcedure.mutation((): any => true),
	create: publicProcedure
		.input(z.object({ appId: z.string(), appName: z.string(), appVersion: z.string().optional() }))
		.mutation((): any => null),
	revealToken: publicProcedure.input(z.object({ appId: z.string() })).mutation((): any => null),
	onPending: publicProcedure.subscription(() => emptySub<any>()),
	onClients: publicProcedure.subscription(() => emptySub<any>()),
});

const updateRouter = router({
	get: publicProcedure.query((): any => null),
	downloaded: publicProcedure.query((): any => false),
	progress: publicProcedure.query((): any => null),
	checking: publicProcedure.query((): any => false),
	check: publicProcedure.input(z.object({ showDialog: z.boolean().optional() }).optional()).mutation((): any => undefined),
	install: publicProcedure.input(z.boolean().optional()).mutation((): any => undefined),
	cancel: publicProcedure.mutation((): any => false),
	onUpdate: publicProcedure.subscription(() => emptySub<any>()),
	onChecking: publicProcedure.subscription(() => emptySub<boolean>()),
	onProgress: publicProcedure.subscription(() => emptySub<any>()),
	onDownloaded: publicProcedure.subscription(() => emptySub<any>()),
});

const navigationRouter = router({
	home: publicProcedure.mutation((): any => undefined),
	goback: publicProcedure.mutation((): any => undefined),
	devTools: publicProcedure.mutation((): any => undefined),
	onSameOrigin: publicProcedure.subscription(() => emptySub<boolean>()),
});

const miniplayerRouter = router({
	open: publicProcedure.mutation((): any => undefined),
	onState: publicProcedure.subscription(() => emptySub<any>()),
});

const trayRouter = router({});

const trayViewRouter = router({
	toggle: publicProcedure.mutation((): any => undefined),
	open: publicProcedure.mutation((): any => undefined),
	hide: publicProcedure.mutation((): any => undefined),
	openMain: publicProcedure.mutation((): any => undefined),
	onState: publicProcedure.subscription(() => emptySub<any>()),
});

const themesRouter = router({
	list: publicProcedure.query((): { id: string; name: string; kind: "builtin" | "custom" }[] => []),
	reload: publicProcedure.mutation((): any => undefined),
});

const lastfmRouter = router({
	status: publicProcedure.query((): any => null),
	profile: publicProcedure.mutation((): any => undefined),
	authorize: publicProcedure.mutation((): any => undefined),
	toggle: publicProcedure.input(z.boolean()).mutation((): any => undefined),
	onStatus: publicProcedure.subscription(() => emptySub<any>()),
	onSubmitState: publicProcedure.subscription(() => emptySub<"start" | "change" | boolean | null>()),
});

const windowRouter = router({
	state: publicProcedure.query((): any => null),
	mainState: publicProcedure.query((): any => null),
	stayOnTop: publicProcedure.mutation((): any => false),
	isStayOnTop: publicProcedure.query((): any => false),
	dialogResponse: publicProcedure.input(z.enum(["close", "ok"])).mutation((): any => false),
	onState: publicProcedure.subscription(() => emptySub<any>()),
	onMainState: publicProcedure.subscription(() => emptySub<any>()),
});

const discordRouter = router({
	connected: publicProcedure.query((): any => false),
	onConnected: publicProcedure.subscription(() => emptySub<true>()),
	onDisconnected: publicProcedure.subscription(() => emptySub<false>()),
	onLoading: publicProcedure.subscription(() => emptySub<true>()),
	onError: publicProcedure.subscription(() => emptySub<string | null>()),
});

export const appRouter = router({
	track: trackRouter,
	settings: settingsRouter,
	app: appServiceRouter,
	api: apiRouter,
	auth: authRouter,
	update: updateRouter,
	navigation: navigationRouter,
	miniplayer: miniplayerRouter,
	tray: trayRouter,
	trayView: trayViewRouter,
	themes: themesRouter,
	lastfm: lastfmRouter,
	window: windowRouter,
	discord: discordRouter,
});

export type AppRouter = typeof appRouter;
