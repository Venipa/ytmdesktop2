import { logger } from "@shared/utils/console";
import { useCallback, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

type LastFmStatus = { connected: boolean; name: string | null; error: string | null };

export function useLastFm() {
	const stateHandle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const [lastFMLoading, setLastFMLoading] = useState(false);
	const [lastFM, setLastFM] = useState<LastFmStatus>({ connected: false, name: null, error: null });
	const [lastFMState, setFmState] = useState<"start" | "change" | boolean | null>(null);

	trpc.lastfm.status.useQuery(undefined, {
		onSuccess: (status) => setLastFM(status as LastFmStatus),
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

	const profile = trpc.lastfm.profile.useMutation({
		onSettled: () => setLastFMLoading(false),
	});
	const authorize = trpc.lastfm.authorize.useMutation({
		onSettled: () => setLastFMLoading(false),
	});

	const authorizeLastFM = useCallback(() => {
		if (lastFM?.connected) {
			profile.mutate();
			return;
		}
		setLastFMLoading(true);
		authorize.mutate();
	}, [lastFM?.connected, profile, authorize]);

	return { lastFMState, setFmState, lastFM, lastFMLoading, authorizeLastFM };
}
