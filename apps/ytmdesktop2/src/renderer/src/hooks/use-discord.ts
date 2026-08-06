import { useCallback, useRef, useState } from "react";
import { useSettingsState } from "@/hooks/use-settings";
import { trpc } from "@/lib/trpc";

/**
 * Discord Rich Presence connection state + enable toggle.
 * Loading/connected/error are gated by `enabled` — no sync effect needed.
 */
export function useDiscord() {
	const utils = trpc.useUtils();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [enabled, setEnabled] = useSettingsState<boolean>("discord.enabled", false);
	const enabledRef = useRef(enabled);
	enabledRef.current = enabled;

	const { data, isSuccess } = trpc.discord.connected.useQuery();
	const connected = isSuccess ? !!data : false;

	trpc.discord.onConnected.useSubscription(undefined, {
		onData: () => {
			if (!enabledRef.current) return;
			utils.discord.connected.setData(undefined, true);
			setError(null);
			setLoading(false);
		},
	});
	trpc.discord.onDisconnected.useSubscription(undefined, {
		onData: () => {
			utils.discord.connected.setData(undefined, false);
			setLoading(false);
		},
	});
	trpc.discord.onLoading.useSubscription(undefined, {
		onData: () => {
			if (!enabledRef.current) return;
			setLoading(true);
		},
	});
	trpc.discord.onError.useSubscription(undefined, {
		onData: (err) => {
			if (!enabledRef.current) return;
			setError(err);
			setLoading(false);
		},
	});

	const toggle = useCallback(() => {
		setError(null);
		setEnabled((prev) => !prev);
	}, [setEnabled]);

	return {
		connected: enabled && connected,
		loading: enabled && loading,
		error: enabled ? error : null,
		enabled,
		setEnabled,
		toggle,
	};
}
