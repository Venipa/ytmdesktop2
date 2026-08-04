import { useCallback, useState } from "react";
import { useSettingsState } from "@/hooks/use-settings";
import { trpc } from "@/lib/trpc";

/**
 * Discord Rich Presence connection state + enable toggle.
 */
export function useDiscord() {
	const [connected, setConnected] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [enabled, setEnabled] = useSettingsState<boolean>("discord.enabled", false);

	trpc.discord.connected.useQuery(undefined, {
		onSuccess: (next) => setConnected(!!next),
	});
	trpc.discord.onConnected.useSubscription(undefined, {
		onData: () => {
			setConnected(true);
			setError(null);
			setLoading(false);
		},
	});
	trpc.discord.onDisconnected.useSubscription(undefined, {
		onData: () => setConnected(false),
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
