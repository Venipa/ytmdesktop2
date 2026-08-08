export type DialogAction = "close" | "ok" | "play" | "queue";
type DialogCallback = (action: DialogAction) => void;

const callbacks = new Map<number, DialogCallback>();

export function registerWindowDialogResponse(webContentsId: number, onResponse: DialogCallback): () => void {
	callbacks.set(webContentsId, onResponse);
	return () => {
		callbacks.delete(webContentsId);
	};
}

export function resolveWindowDialogResponse(webContentsId: number, action: DialogAction): boolean {
	const onResponse = callbacks.get(webContentsId);
	if (!onResponse) return false;
	onResponse(action);
	return true;
}
