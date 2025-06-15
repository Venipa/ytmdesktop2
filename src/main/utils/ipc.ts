import { createId } from "@paralleldrive/cuid2";
import { IpcMainEvent, WebContentsView, ipcMain } from "electron";

export function createSendHandler<T = unknown>(view: WebContentsView, event: string, options: { timeout?: number } = {}) {
	return (...requestArgs: any[]) =>
		new Promise<T>((resolve, reject) => {
			const requestId = createId();
			const handleResponse = (ev: IpcMainEvent, requestIdFromClient: string, ...responsePayload: any[]) => {
				if (requestIdFromClient !== requestId) return;
				if (responsePayload[1] === "error") destroyPromise(new Error(responsePayload[2] ?? "Unknown error"));
				destroyPromise();
				resolve(responsePayload as T);
			};
			ipcMain.on(`${event}/response.${requestId}`, handleResponse);
			view.webContents.send(event, {
				requestId,
				payload: requestArgs,
			});
			const timeout = setTimeout(() => {
				destroyPromise(new Error(`Request timed out after ${options.timeout ?? 10000}ms`));
			}, options.timeout ?? 10000);
			const destroyPromise = (err?: Error) => {
				ipcMain.off(`${event}/response.${requestId}`, handleResponse);
				clearTimeout(timeout);
				if (err) reject(err);
			};
			return destroyPromise;
		});
}
