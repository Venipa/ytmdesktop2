import type { AppToastPayload } from "@main/trpc/routers/app/router";
import type { BrowserWindowViews } from "@main/windows/mappedWindow";
import IPC_EVENT_NAMES from "@shared/constants/eventNames";

/** Push a toast to the main renderer via `app.toast` / sonner bridge. */
export function emitAppToast(
	windowContext: Pick<BrowserWindowViews<unknown>, "sendToAllViews"> | null | undefined,
	payload: AppToastPayload,
): void {
	if (!windowContext?.sendToAllViews || !payload?.message) return;
	windowContext.sendToAllViews(IPC_EVENT_NAMES.APP_TOAST, payload);
}

export function friendlyQueueAddError(err: unknown): string {
	const message = err instanceof Error ? err.message : String(err ?? "");
	if (/play a track first|queue context missing/i.test(message)) {
		return "Play a song first, then add to queue.";
	}
	if (/get_queue returned no items/i.test(message)) {
		return "Could not add to queue — track not found.";
	}
	if (/ytm not ready|youtube view missing/i.test(message)) {
		return "YouTube Music is not ready yet.";
	}
	return message.trim() || "Could not add to queue.";
}
