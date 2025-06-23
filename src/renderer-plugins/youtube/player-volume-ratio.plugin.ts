// This file is a slightly edited version of of the script found here:
// https://greasyfork.org/en/scripts/397686-youtube-music-fix-volume-ratio
// Made by: Marco Pfeiffer <git@marco.zone>

import definePlugin from "@plugins/utils";
export default definePlugin(
	"player-volume-ratio",
	{
		enabled: true,
		displayName: "Youtube Player Volume Ratio Handler",
	},
	{
		cmds: {
			async forceUpdate({ playerApi, api, log }, [volume]: [number]) {
				playerApi.setVolume((volume = volume ?? playerApi.getVolume()));
				log.debug("Force updated volume ratio", volume);
				return volume;
			},
		},
	},
);
