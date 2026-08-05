import { useCallback, useState } from "react";
import { useSettingsState } from "@/hooks/use-settings";
import { trpc } from "@/lib/trpc";

/**
 * Discord Rich Presence connection state + enable toggle.
 */
export function useDiscord() {
	const utils = trpc.useUtils();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [enabled, setEnabled] = useSettingsState<boolean>("discord.enabled", false);

	const { data, isSuccess } = trpc.discord.connected.useQuery();
	const connected = isSuccess ? !!data : false;

	trpc.discord.onConnected.useSubscription(undefined, {
		onData: () => {
			utils.discord.connected.setData(undefined, true);
			setError(null);
			setLoading(false);
		},
	});
	trpc.discord.onDisconnected.useSubscription(undefined, {
		onData: () => {
			utils.discord.connected.setData(undefined, false);
		},
	});
	trpc.discord.onLoading.useSubscription(undefined, {
		onData: () => setLoading(true),
	});
	trpc.discord.onError.useSubscription(undefined, {
		onData: (err) => setError(err),
	});

	const toggle = useCallback(() => {
		setError(null);
		setEnabled((prev) => !prev);
	}, [setEnabled]);

	return {
		connected,
		loading,
		error,
		enabled,
		setEnabled,
		toggle,
	};
}
