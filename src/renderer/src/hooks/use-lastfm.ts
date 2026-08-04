import type { AppRouter } from "@main/trpc/router";
import { logger } from "@shared/utils/console";
import type { inferRouterOutputs } from "@trpc/server";
import { useCallback, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

type LastFmStatus = NonNullable<inferRouterOutputs<AppRouter>["lastfm"]["status"]>;

export function useLastFm() {
	const stateHandle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const [lastFMLoading, setLastFMLoading] = useState(false);
	const [lastFM, setLastFM] = useState<LastFmStatus>({ connected: false, name: null, error: false, processing: false });
	const [lastFMState, setFmState] = useState<"start" | "change" | boolean | null>(null);

	trpc.lastfm.status.useQuery(undefined, {
		onSuccess: (status) => setLastFM(status),
	});

	trpc.lastfm.onStatus.useSubscription(undefined, {
		onData: (status) => setLastFM(status as LastFmStatus),
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

	const authorizeLastFM = useCallback(() => {
		if (lastFM?.connected) {
			void profile();
			return;
		}
		setLastFMLoading(true);
		void authorize();
	}, [lastFM?.connected, profile, authorize]);

	return { lastFMState, setFmState, lastFM, lastFMLoading, authorizeLastFM };
}
