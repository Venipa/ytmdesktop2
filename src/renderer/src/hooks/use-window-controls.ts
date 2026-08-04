import { trpc } from "@/lib/trpc";

/**
 * Window chrome actions (minimize / maximize / close / quit).
 */
export function useWindowControls() {
	const { mutateAsync: minimize, isLoading: minimizePending } = trpc.app.minimize.useMutation();
	const { mutateAsync: maximize, isLoading: maximizePending } = trpc.app.maximize.useMutation();
	const { mutateAsync: quit, isLoading: quitPending } = trpc.app.quit.useMutation();
	const { mutateAsync: close, isLoading: closePending } = trpc.app.closeWindow.useMutation();

	return {
		minimize,
		maximize,
		quit,
		close,
		isPending: minimizePending || maximizePending || quitPending || closePending,
	};
}
