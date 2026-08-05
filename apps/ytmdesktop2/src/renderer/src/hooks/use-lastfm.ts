import type { AppRouter } from "@main/trpc/router";
import { logger } from "@shared/utils/console";
import type { inferRouterOutputs } from "@trpc/server";
import { useCallback, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

type LastFmStatus = NonNullable<inferRouterOutputs<AppRouter>["lastfm"]["status"]>;

const EMPTY_STATUS: LastFmStatus = { connected: false, name: null, error: false, processing: false };

export function useLastFm() {
	const utils = trpc.useUtils();
	const stateHandle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const [lastFMLoading, setLastFMLoading] = useState(false);
	const [lastFMState, setFmState] = useState<"start" | "change" | boolean | null>(null);

	const { data, isSuccess } = trpc.lastfm.status.useQuery();
	const lastFM: LastFmStatus = isSuccess ? (data as LastFmStatus) : EMPTY_STATUS;

	trpc.lastfm.onStatus.useSubscription(undefined, {
		onData: (status) => {
			utils.lastfm.status.setData(undefined, status);
		},
	});

	trpc.lastfm.onSubmitState.useSubscription(undefined, {
		onData: (fmstate) => {
			setFmState((prev) => {
				if (typeof prev === "string" && typeof fmstate === "boolean") {
					if (stateHandle.current) clearTimeout(stateHandle.current);
					stateHandle.current = setTimeout(() => {
						setFmState(null);
						logger.debug("clear fm submit state");
					}, 2000);
				}
				return fmstate;
			});
		},
	});

	const { mutateAsync: profile } = trpc.lastfm.profile.useMutation({
		onSettled: () => setLastFMLoading(false),
	});
	const { mutateAsync: authorize } = trpc.lastfm.authorize.useMutation({
		onSettled: () => setLastFMLoading(false),
	});
	const { mutateAsync: toggle, isLoading: togglePending } = trpc.lastfm.toggle.useMutation({
		onSuccess: (status) => {
			utils.lastfm.status.setData(undefined, status);
		},
	});

	const authorizeLastFM = useCallback(() => {
		if (lastFM?.connected) {
			void profile();
			return;
		}
		setLastFMLoading(true);
		void authorize();
	}, [lastFM?.connected, profile, authorize]);

	const toggleLastFM = useCallback(
		(next: boolean) => {
			if (togglePending || lastFM.processing) return Promise.resolve(lastFM);
			return toggle(next);
		},
		[toggle, togglePending, lastFM],
	);

	return {
		lastFMState,
		setFmState,
		lastFM,
		lastFMLoading,
		authorizeLastFM,
		toggleLastFM,
		togglePending,
		isBusy: togglePending || lastFMLoading || !!lastFM.processing,
	};
}
