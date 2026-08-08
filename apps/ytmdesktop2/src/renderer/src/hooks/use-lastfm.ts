import type { AppRouter } from "@main/trpc/router";
import { logger } from "@shared/utils/console";
import type { inferRouterOutputs } from "@trpc/server";
import { useCallback, useRef, useState } from "react";
import { useSettingsState } from "@/hooks/use-settings";
import { trpc } from "@/lib/trpc";

type LastFmStatus = NonNullable<inferRouterOutputs<AppRouter>["lastfm"]["status"]>;

const EMPTY_STATUS: LastFmStatus = { connected: false, name: null, error: false, processing: false };

/**
 * Last.fm connection state + enable toggle.
 * Switch is driven by `lastfm.enabled` (optimistic) — same pattern as Discord.
 */
export function useLastFm() {
	const utils = trpc.useUtils();
	const stateHandle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const [lastFMLoading, setLastFMLoading] = useState(false);
	const [lastFMState, setFmState] = useState<"start" | "change" | boolean | null>(null);
	const [enabled, setEnabled] = useSettingsState<boolean>("lastfm.enabled", false);
	const enabledRef = useRef(enabled);
	enabledRef.current = enabled;

	const { data, isSuccess } = trpc.lastfm.status.useQuery();
	const status: LastFmStatus = isSuccess ? (data as LastFmStatus) : EMPTY_STATUS;
	const lastFM: LastFmStatus = {
		...status,
		// Gate connected by enabled so disable flips UI immediately even if IPC lags
		connected: enabled && !!status.connected,
		// Keep raw processing — auth window can run while enabled setting catches up
		processing: !!status.processing,
	};

	trpc.lastfm.onStatus.useSubscription(undefined, {
		onData: (next) => {
			if (!next.processing) setLastFMLoading(false);
			if (!enabledRef.current) {
				utils.lastfm.status.setData(undefined, { ...next, connected: false });
				return;
			}
			utils.lastfm.status.setData(undefined, next);
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
	const { mutateAsync: authorize, isPending: authorizePending } = trpc.lastfm.authorize.useMutation();
	const { mutateAsync: reauth, isPending: reauthPending } = trpc.lastfm.reauth.useMutation();

	const authorizeLastFM = useCallback(() => {
		if (lastFM?.connected) {
			void profile();
			return;
		}
		setLastFMLoading(true);
		void authorize();
	}, [lastFM?.connected, profile, authorize]);

	const reauthLastFM = useCallback(() => {
		setLastFMLoading(true);
		void reauth();
	}, [reauth]);

	const toggleLastFM = useCallback(
		(next: boolean) => {
			setEnabled(next);
			return Promise.resolve();
		},
		[setEnabled],
	);

	const isBusy = lastFMLoading || authorizePending || reauthPending || !!status.processing;

	return {
		lastFMState,
		setFmState,
		lastFM,
		lastFMLoading,
		authorizeLastFM,
		reauthLastFM,
		toggleLastFM,
		enabled,
		setEnabled,
		togglePending: false,
		isBusy,
	};
}
