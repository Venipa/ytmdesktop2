import { useState } from "react";
import { trpc } from "@/lib/trpc";

export type MiniPlayerState = { active?: boolean } | null;

/**
 * Mini player window: visibility state + open action.
 */
export function useMiniPlayer() {
	const [state, setState] = useState<MiniPlayerState>(null);
	const { mutateAsync: open, isLoading: isPending } = trpc.miniplayer.open.useMutation();

	trpc.miniplayer.onState.useSubscription(undefined, {
		onData: setState,
	});

	return {
		state,
		active: !!state?.active,
		open,
		isPending,
	};
}
