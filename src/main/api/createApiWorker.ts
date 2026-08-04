import { createMainCaller } from "@main/trpc/caller";
import type ApiProvider from "@main/trpc/routers/api/service";
import type SettingsProvider from "@main/trpc/routers/settings/service";
import { apiWorkerModuleId } from "@main/workerPaths";
import { WorkerAgent } from "@main/workers";
import { API_ROUTES } from "@shared/constants/eventNames";
import logger from "@shared/utils/Logger";
import { BrowserWindow } from "electron";

export interface ApiWorker {
	send(name: string, ...args: any[]): void;
	invoke<T = any>(name: string, ...args: any[]): Promise<T>;
	initialize(settings: SettingsProvider["instance"]): Promise<number>;
	destroy(): Promise<void>;
}

const agent = () => new WorkerAgent(apiWorkerModuleId);

export const createApiWorker = async (api: ApiProvider, parent?: BrowserWindow): Promise<ApiWorker> => {
	let worker: WorkerAgent<{ name: string; data?: any }, any> | null = agent();
	if (parent) parent.on("close", () => worker!.requestExit());

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
		[API_ROUTES.TRACK_CURRENT]: () => trackCaller().current(),
		[API_ROUTES.TRACK_CURRENT_STATE]: () => trackCaller().state(),
		[API_ROUTES.TRACK_LIKE]: (like?: boolean) => trackCaller().like(!!like),
		[API_ROUTES.TRACK_DISLIKE]: (dislike?: boolean) => trackCaller().dislike(!!dislike),
	};

	worker.on("result", (err, out) => {
		if (err) return logger.error(err);
		if (!out || typeof out !== "object" || !out.name) return;
		Promise.resolve(apiMap[out.name]?.(...[out.data].flat()) ?? null).then((result) => {
			return Promise.resolve(worker?.runOperation({ name: "event", data: [out.id, result] }) ?? null);
		});
	});

	return new (class {
		constructor() {}
		send(name: string, ...args: any[]) {
			worker!.runOperation({ name, data: args });
		}
		async initialize(settings: SettingsProvider["instance"]) {
			return await this.invoke<number>("initialize", {
				config: { ...settings },
				routes: Object.keys(apiMap),
			});
		}
		async invoke<T = any>(name: string, ...args: any[]) {
			return await new Promise<T>((resolve, reject) => {
				worker!.once("result", (err, data) => {
					if (err) reject(err);
					else resolve(data);
				});
				worker!.runOperation({ name, data: args });
			});
		}
		async destroy() {
			if (!worker) return;
			worker.runOperation({ name: "destroy" });
			worker.requestExit();
			worker = null;
		}
	})();
};
