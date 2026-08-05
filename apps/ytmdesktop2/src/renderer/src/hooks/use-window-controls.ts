import { trpc } from "@/lib/trpc";

/**
 * Window chrome actions (minimize / maximize / close / quit / dialog response).
 */
export function useWindowControls() {
	const { mutateAsync: minimize, isLoading: minimizePending } = trpc.app.minimize.useMutation();
	const { mutateAsync: maximize, isLoading: maximizePending } = trpc.app.maximize.useMutation();
	const { mutateAsync: quit, isLoading: quitPending } = trpc.app.quit.useMutation();
	const { mutateAsync: close, isLoading: closePending } = trpc.app.closeWindow.useMutation();
	const { mutateAsync: dialogResponse, isLoading: dialogPending } = trpc.window.dialogResponse.useMutation();

	return {
		minimize,
		maximize,
		quit,
		close,
		dialogResponse,
		isPending: minimizePending || maximizePending || quitPending || closePending || dialogPending,
	};
}
