import { appRouter } from "@main/trpc/router";
import { createMainTrpcContext } from "./context";

type TrackCaller = {
	current: () => Promise<unknown>;
	state: () => Promise<{ liked?: boolean; disliked?: boolean; playing?: boolean; duration?: number; progress?: number } | null>;
	accent: () => Promise<string | null>;
	routes: () => Promise<string[]>;
	like: (input: { liked: boolean }) => Promise<boolean | null>;
	dislike: (input: { disliked: boolean }) => Promise<boolean | null>;
	next: () => Promise<{ isPlaying: boolean; time: number }>;
	prev: () => Promise<{ isPlaying: boolean; time: number }>;
	play: () => Promise<{ isPlaying: boolean; time: number }>;
	pause: () => Promise<{ isPlaying: boolean; time: number }>;
	togglePlay: () => Promise<{ isPlaying: boolean; time: number }>;
	repeat: () => Promise<unknown>;
	shuffle: () => Promise<unknown>;
	volume: (input?: { volume?: number }) => Promise<{ volume: number }>;
	volumeUp: (input?: { amount?: number }) => Promise<{ volume: number }>;
	volumeDown: (input?: { amount?: number }) => Promise<{ volume: number }>;
	forward: (input: { time: number }) => Promise<{ isPlaying: boolean; time: number }>;
	backward: (input: { time: number }) => Promise<{ isPlaying: boolean; time: number }>;
	seek: (input: { time: number; type?: "seek" }) => Promise<{ isPlaying: boolean; time: number }>;
};

type NavigationCaller = {
	home: () => Promise<{ ok: true }>;
	goback: () => Promise<void>;
	devTools: () => Promise<void>;
	open: (input: { url: string }) => Promise<{ ok: true; link: unknown }>;
	watch: (input: { videoId: string; playlistId?: string }) => Promise<{ ok: true }>;
	playlist: (input: { playlistId: string; play?: boolean }) => Promise<{ ok: true }>;
	channel: (input: { channelId?: string; handle?: string }) => Promise<{ ok: true }>;
	queue: (input: { videoId?: string; playlistId?: string }) => Promise<{ ok: true }>;
	queueList: () => Promise<{ items: { index: number; videoId?: string; title?: string }[]; count: number; storeHooked?: boolean }>;
	queueClear: () => Promise<{ ok: true }>;
};

export type MainCaller = {
	track: TrackCaller;
	navigation: NavigationCaller;
};

/**
 * Typed main-process caller — same procedures as renderer IPC client.
 * Cast: tRPC 10 + TS 5.9 nested CreateRouterInner inference collapses to never.
 */
export function createMainCaller(): MainCaller {
	return appRouter.createCaller(createMainTrpcContext()) as unknown as MainCaller;
}
