import { BaseEvent, OnEventExecute } from "@main/core/baseEvent";
import { trackService } from "@main/trpc/routers/track";
import { TrackData } from "@shared/track/trackData";

// todo: remove nested server event calls
export default class TrackInfoChange extends BaseEvent implements OnEventExecute {
	constructor() {
		super("track:change");
	}
	execute(track: TrackData) {
		trackService.pushTrackToViews(track);
	}
}
