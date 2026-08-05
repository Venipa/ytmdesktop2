import { apiAuth } from "@main/api/auth";
import { type ApiServerHandle, startApiServer } from "@main/api/server";
import { createMainCaller } from "@main/trpc/caller";
import type ApiProvider from "@main/trpc/routers/api/service";
import type SettingsProvider from "@main/trpc/routers/settings/service";
import { API_ROUTES } from "@shared/constants/eventNames";
import { createLogger } from "@shared/utils/console";
import type { BrowserWindow } from "electron";

const log = createLogger("api-worker");

export interface ApiWorker {
	send(name: string, ...args: any[]): void;
	invoke<T = any>(name: string, ...args: any[]): Promise<T>;
	initialize(settings: SettingsProvider["instance"]): Promise<number>;
	destroy(): Promise<void>;
}

export const createApiWorker = async (api: ApiProvider, parent?: BrowserWindow): Promise<ApiWorker> => {
	let handle: ApiServerHandle | null = null;

	const trackCaller = () => createMainCaller().track;
	const apiMap: Record<string, (...args: any[]) => Promise<unknown> | unknown> = {
		"api/routes": () => api.getRoutes(),
		[API_ROUTES.TRACK_CONTROL_NEXT]: () => trackCaller().next(),
		[API_ROUTES.TRACK_CONTROL_PREV]: () => trackCaller().prev(),
		[API_ROUTES.TRACK_CONTROL_BACKWARD]: (data?: { time?: number }) => trackCaller().backward({ time: data?.time ?? 0 }),
		[API_ROUTES.TRACK_CONTROL_FORWARD]: (data?: { time?: number }) => trackCaller().forward({ time: data?.time ?? 0 }),
		[API_ROUTES.TRACK_ACCENT]: () => trackCaller().accent(),
		[API_ROUTES.TRACK_CONTROL_PAUSE]: () => trackCaller().pause(),
		[API_ROUTES.TRACK_CONTROL_PLAY]: () => trackCaller().play(),
		[API_ROUTES.TRACK_CONTROL_TOGGLE_PLAY]: () => trackCaller().togglePlay(),
		[API_ROUTES.TRACK_CONTROL_SEEK]: (data?: { time: number; type?: "seek" }) => trackCaller().seek(data as { time: number; type?: "seek" }),
		[API_ROUTES.TRACK_CONTROL_REPEAT]: () => trackCaller().repeat(),
		[API_ROUTES.TRACK_CONTROL_SHUFFLE]: () => trackCaller().shuffle(),
		[API_ROUTES.TRACK_CONTROL_VOLUME]: (data?: { volume?: number }) => trackCaller().volume(data),
		[API_ROUTES.TRACK_CONTROL_VOLUME_UP]: (data?: { amount?: number }) => trackCaller().volumeUp(data),
		[API_ROUTES.TRACK_CONTROL_VOLUME_DOWN]: (data?: { amount?: number }) => trackCaller().volumeDown(data),
		[API_ROUTES.TRACK_CURRENT]: () => trackCaller().current(),
		[API_ROUTES.TRACK_CURRENT_STATE]: () => trackCaller().state(),
		[API_ROUTES.TRACK_LIKE]: (like?: boolean) => trackCaller().like(!!like),
		[API_ROUTES.TRACK_DISLIKE]: (dislike?: boolean) => trackCaller().dislike(!!dislike),
		[API_ROUTES.AUTH_REQUEST_CODE]: (data?: { appId: string; appName: string; appVersion: string }) =>
			apiAuth.requestCode(data as { appId: string; appName: string; appVersion: string }),
		[API_ROUTES.AUTH_REQUEST]: (data?: { appId: string; code: string }) => apiAuth.requestToken(data as { appId: string; code: string }),
	};

	const onRequest = async (name: string, data?: unknown) => {
		const fn = apiMap[name];
		if (!fn) throw new Error(`Unknown API route: ${name}`);
		return await Promise.resolve(fn(...[data].flat()));
	};

	const destroy = async () => {
		if (!handle) return;
		const active = handle;
		handle = null;
		await active.destroy();
	};

	const initialize = async (settings: SettingsProvider["instance"]) => {
		if (handle) await destroy();
		apiAuth.loadClients(settings.api?.clients);
		handle = await startApiServer({
			config: { ...settings },
			routes: Object.keys(apiMap),
			onRequest,
			isAuthorized: (token) => apiAuth.isValidToken(token),
		});
		log.debug("api server ready", { port: handle.port });
		return process.pid;
	};

	if (parent) {
		parent.on("close", () => {
			void destroy();
		});
	}

	const worker: ApiWorker = {
		send(name: string, ...args: any[]) {
			handle?.send(name, ...args);
		},
		initialize,
		destroy,
		async invoke<T = any>(name: string, ...args: any[]) {
			if (name === "socket") {
				handle?.send(String(args[0] ?? ""), ...args.slice(1));
				return undefined as T;
			}
			if (name === "initialize") {
				const payload = args[0] as { config?: SettingsProvider["instance"] } | SettingsProvider["instance"] | undefined;
				const settings =
					payload && typeof payload === "object" && "config" in payload && payload.config ? payload.config : (payload as SettingsProvider["instance"]);
				return (await initialize(settings)) as T;
			}
			if (name === "destroy" || name === "close") {
				await destroy();
				return undefined as T;
			}
			return (await onRequest(name, args[0])) as T;
		},
	};

	return worker;
};
