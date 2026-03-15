// This file is a slightly edited version of of the script found here:
// https://greasyfork.org/en/scripts/397686-youtube-music-fix-volume-ratio
// Made by: Marco Pfeiffer <git@marco.zone>

import definePlugin from "@plugins/utils";
import EventEmitter from "events";
import { PlayerApi } from "ytm-client-api";

const EXPONENT = 3;
const MIN_VOLUME = 0.05;
const events = new EventEmitter();
const syncVolume = (playerApi: PlayerApi) => {
	if (playerApi.getPlayerState() === 3) {
		setTimeout(() => syncVolume(playerApi), 0);
		return;
	}

	playerApi.setVolume(playerApi.getVolume());
};
export default definePlugin(
	"player-volume-ratio",
	{
		enabled: true,
		displayName: "Youtube Player Volume Ratio Handler",
	},
	{
		afterInit({ settings, domUtils, log, playerApi }) {
			const isEnabled = () => !!settings.volumeRatio?.enabled;
			const handleSyncVolume = () => syncVolume(playerApi);
			events.on("syncVolume", handleSyncVolume);

			const storedOriginalVolumes = new WeakMap<HTMLMediaElement, number>();
			const propertyDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "volume");
			Object.defineProperty(HTMLMediaElement.prototype, "volume", {
				get(this: HTMLMediaElement) {
					const lowVolume = (propertyDescriptor?.get?.call(this) as number) ?? 0;
					const calculatedOriginalVolume = lowVolume ** (1 / EXPONENT);

					const storedOriginalVolume = storedOriginalVolumes.get(this) ?? 0;
					const storedDeviation = Math.abs(storedOriginalVolume - calculatedOriginalVolume);
					if (!isEnabled()) {
						return storedOriginalVolume;
					}
					return storedDeviation < MIN_VOLUME ? storedOriginalVolume : calculatedOriginalVolume;
				},
				set(this: HTMLMediaElement, originalVolume: number) {
					const lowVolume = originalVolume ** EXPONENT;
					storedOriginalVolumes.set(this, originalVolume);
					propertyDescriptor?.set?.call(this, lowVolume);
				},
			});
			syncVolume(playerApi);
			return () => {
				events.off("syncVolume", handleSyncVolume);
			};
		},
		cmds: {
			async syncVolume({ playerApi, log }, [volume]: [number]) {
				log.debug("Syncing volume");
				if (volume !== undefined && typeof volume === "number") {
					playerApi.setVolume(volume);
				} else {
					syncVolume(playerApi);
				}
				return true;
			},
		},
	},
);
