import { serverMain } from "@main/ipc/serverEvents";
import IPC_EVENT_NAMES from "@shared/constants/eventNames";
import { BrowserWindow, WebContentsView } from "electron";

type TrackControlTypes = StringLiteral<"play" | "pause" | "next" | "prev" | "toggle">;
type TrackControlFn = <T extends { type: TrackControlTypes } = any>(type: TrackControlTypes) => Promise<T>;
export interface BrowserWindowViews<T, TView extends WebContentsView = WebContentsView> {
	main: BrowserWindow;
	views: { [key: string]: TView } & T;
	/** Global bus emit for tRPC subscriptions / serverMain listeners — no webContents.send. */
	sendToAllViews(ev: string, ...args: any[]): void;
	sendTrackControl: TrackControlFn;
}

export function getViewObject(bwv: { [key: string]: WebContentsView }) {
	if (!bwv) return {};
	return Object.entries(bwv)
		.filter(([, view]) => view?.webContents)
		.map(([key, view]) => ({ id: view.webContents.id, name: key }))
		.reduce((l, r) => ({ ...l, [r.name]: r.id }), {});
}
export function createWindowContext<T, TView extends WebContentsView = WebContentsView>(_data: {
	main: BrowserWindow;
	views: { [key: string]: TView } & T;
}): BrowserWindowViews<T, TView> {
	return new (class implements BrowserWindowViews<T, TView> {
		main: BrowserWindow = _data.main;
		views: { [key: string]: TView } & T = _data.views || ({} as any);
		async sendTrackControl<T extends { type: TrackControlTypes } = any>(type: TrackControlTypes) {
			const view = this.views.youtubeView;
			if (!view) return Promise.reject(new Error("View not found"));
			const data = ((await view.invoke<T>(IPC_EVENT_NAMES.TRACK_CONTROL, { type })) ?? {}) as T;
			if (data.type !== type) throw new Error("Invalid response");
			return data as T;
		}
		sendToAllViews(ev: string, ...args: any[]): void {
			serverMain.emit(ev, ...args);
		}
	})();
}
