import ApiProvider from "@main/plugins/apiProvider.plugin";
import SettingsProvider from "@main/plugins/settingsProvider.plugin";
import { API_ROUTES } from "@main/utils/eventNames";
import { WorkerAgent } from "@main/utils/worker";
import { apiWorkerModuleId } from "@main/workerPaths";
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
	const apiMap = {
		"api/routes": api.getRoutes,
		[API_ROUTES.TRACK_CONTROL_NEXT]: api.nextTrack,
		[API_ROUTES.TRACK_CONTROL_PREV]: api.prevTrack,
		[API_ROUTES.TRACK_CONTROL_BACKWARD]: api.backwardTrack,
		[API_ROUTES.TRACK_CONTROL_FORWARD]: api.forwardTrack,
		[API_ROUTES.TRACK_ACCENT]: api.getTrackAccent,
		[API_ROUTES.TRACK_CONTROL_PAUSE]: api.pauseTrack,
		[API_ROUTES.TRACK_CONTROL_PLAY]: api.playTrack,
		[API_ROUTES.TRACK_CONTROL_TOGGLE_PLAY]: api.toggleTrackPlayback,
		[API_ROUTES.TRACK_CONTROL_SEEK]: api.seekTrack,
		[API_ROUTES.TRACK_CURRENT]: api.getTrackInformation,
		[API_ROUTES.TRACK_CURRENT_STATE]: api.getTrackState,
		[API_ROUTES.TRACK_LIKE]: api.postTrackLike,
		[API_ROUTES.TRACK_DISLIKE]: api.postTrackDisLike,
	};
	worker.on("result", (err, out) => {
		if (err) return logger.error(err);
		if (!out || typeof out !== "object" || !out.name) return;
		Promise.resolve((apiMap[out.name] as any)?.bind(api, ...[out.data].flat())()).then((result) => {
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
