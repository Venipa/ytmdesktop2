import type { AppRouter } from "@main/trpc/router";
import type { ProgressInfo, UpdateInfo } from "@shared/utils/updater";
import type { inferRouterOutputs } from "@trpc/server";
import { useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";

type RouterUpdateInfo = NonNullable<inferRouterOutputs<AppRouter>["update"]["get"]>;

/**
 * App updater: current update info, download progress, and check/install actions.
 */
export function useUpdater() {
	const utils = trpc.useUtils();
	const { data: updateInfo = null } = trpc.update.get.useQuery();
	const { data: downloaded = false } = trpc.update.downloaded.useQuery();
	const [progress, setProgress] = useState<ProgressInfo | null>(null);
	const [checking, setChecking] = useState(false);

	const checkMutation = trpc.update.check.useMutation({
		onSettled: () => setChecking(false),
	});
	const installMutation = trpc.update.install.useMutation();

	trpc.update.onUpdate.useSubscription(undefined, {
		onData: (info) => utils.update.get.setData(undefined, (info as UpdateInfo | RouterUpdateInfo | null) ?? null),
	});
	trpc.update.onChecking.useSubscription(undefined, {
		onData: (isChecking) => setChecking(!!isChecking),
	});
	trpc.update.onProgress.useSubscription(undefined, {
		onData: (next) => setProgress(next as ProgressInfo | null),
	});
	trpc.update.onDownloaded.useSubscription(undefined, {
		onData: () => {
			utils.update.downloaded.setData(undefined, true);
			setProgress(null);
		},
	});

	const check = useCallback(() => {
		if (checking || checkMutation.isLoading) return Promise.resolve();
		setChecking(true);
		return checkMutation.mutateAsync();
	}, [checking, checkMutation]);

	const install = useCallback(
		(quitAndInstall = true) => installMutation.mutateAsync(quitAndInstall),
		[installMutation],
	);

	/** Check for updates, or install if already downloaded. */
	const runUpdate = useCallback(() => {
		if (downloaded) return install(true);
		return check();
	}, [downloaded, install, check]);

	return {
		updateInfo: updateInfo as UpdateInfo | null,
		downloaded,
		progress,
		checking: checking || checkMutation.isLoading,
		installing: installMutation.isLoading,
		isPending: checking || checkMutation.isLoading || installMutation.isLoading,
		check,
		install,
		runUpdate,
	};
}
