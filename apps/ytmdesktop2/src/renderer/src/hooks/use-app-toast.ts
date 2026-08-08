import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type ToastPayload = { type?: "success" | "info" | "error"; message: string };

/** Bridge main-process `app.toast` events to sonner on the main window. */
export function useAppToast() {
	trpc.app.onToast.useSubscription(undefined, {
		onData: (raw) => {
			const payload = raw as ToastPayload | null | undefined;
			if (!payload?.message) return;
			const type = payload.type ?? "info";
			if (type === "success") toast.success(payload.message);
			else if (type === "error") toast.error(payload.message);
			else toast.message(payload.message);
		},
	});
}
