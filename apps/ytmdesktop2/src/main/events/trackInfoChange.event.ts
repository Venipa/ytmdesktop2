import { BaseEvent, OnEventExecute } from "@main/core/baseEvent";
import { TrackData } from "@shared/track/trackData";

/**
 * Legacy server listener for track:change.
 * Do NOT call pushTrackToViews here — TrackService already emits track:change via
 * sendToAllViews, and re-entering caused lastfm/scrobble spam.
 */
export default class TrackInfoChange extends BaseEvent implements OnEventExecute {
	constructor() {
		super("track:change");
	}
	execute(_track: TrackData | null) {
		// intentional no-op: track subscribers (tRPC / trackService.onTrackChange) handle track:change
	}
}
