import { platform } from "@electron-toolkit/utils";
import { AfterInit, BaseProvider, OnDestroy } from "@main/utils/baseProvider";
import { getNativeImage } from "@main/utils/imageUtils";
import NextIconPath from "~/build/next.png?asset";
import PauseIconPath from "~/build/pause.png?asset";
import PlayIconPath from "~/build/play.png?asset";
import PreviousIconPath from "~/build/prev.png?asset";
const PreviousIcon = getNativeImage(PreviousIconPath);
const PauseIcon = getNativeImage(PauseIconPath);
const PlayIcon = getNativeImage(PlayIconPath);
const NextIcon = getNativeImage(NextIconPath);

export default class WinControlProvider extends BaseProvider implements AfterInit, OnDestroy {
	constructor() {
		super("winControl");
	}
	private trackStateSubscription: () => void;
	private get trackProvider() {
		return this.getProvider("track");
	}
	private get apiProvider() {
		return this.getProvider("api");
	}
	async AfterInit() {
		if (!platform.isWindows) return;
		this.updateThumbarButtons();
		this.trackStateSubscription = this.trackProvider.onTrackStateChange((s) => s.eventType === "state" && this.updateThumbarButtons(s.playing));
	}
	private updateThumbarButtons(isPlaying: boolean = false) {
		try {
			this.windowContext.main.setThumbarButtons([
				{
					tooltip: "Previous",
					icon: PreviousIcon,
					click: () => this.apiProvider.prevTrack(),
				},
				{
					tooltip: "Play/Pause",
					// Update icon based on play state
					icon: !isPlaying ? PlayIcon : PauseIcon,
					click: () => this.apiProvider.toggleTrackPlayback(),
				},
				{
					tooltip: "Next",
					icon: NextIcon,
					click: () => this.apiProvider.nextTrack(),
				},
			]);
		} catch (error) {
			this.logger.error("Failed to update thumbar buttons", error);
		}
	}
	async OnDestroy() {
		this.windowContext.main.setThumbarButtons([]);
		this.trackStateSubscription?.();
	}
}
