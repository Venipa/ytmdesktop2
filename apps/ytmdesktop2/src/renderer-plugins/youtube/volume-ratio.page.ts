import { definePageCmds } from "@plugins/define-bridge";
import { getPagePlayerApi } from "./world0/context";

export function forceUpdateVolume(volume?: number): number | undefined {
	const player = getPagePlayerApi();
	if (!player) return volume;
	const next = volume ?? player.getVolume();
	player.setVolume(next);
	return next;
}

/**
 * Page cmd handlers + bridge for volume-ratio.
 * Safe in world0 (no electron / preload).
 */
export const volumeRatioPage = definePageCmds({
	name: "volume_ratio",
	cmds: {
		forceUpdate: (volume) => forceUpdateVolume(volume as number | undefined),
	},
});

export const VOLUME_RATIO_MSG = volumeRatioPage.type;

/** Fire-and-forget (boot / settings). Prefer `request` for IPC cmds. */
export function postVolumeRatioForceUpdate(volume?: number): void {
	volumeRatioPage.notify("forceUpdate", volume);
}

/** Preload cmd: page world setVolume, return applied volume. */
export function requestVolumeRatioForceUpdate(volume?: number): Promise<number | undefined> {
	return volumeRatioPage.request("forceUpdate", volume);
}
