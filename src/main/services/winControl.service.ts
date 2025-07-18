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
	private disposeSubscriptions: (() => void)[] = [];
	private get trackProvider() {
		return this.getProvider("track");
	}
	private get apiProvider() {
		return this.getProvider("api");
	}
	async AfterInit() {
		try {
			if (platform.isWindows) {
				this.updateThumbarButtons(this.trackProvider.playing);
			}
			this.updateThumbProgress(0, this.trackProvider.playing);
			this.disposeSubscriptions.push(
				this.trackProvider.onTrackStateChange((s) => {
					if (s.eventType === "state") this.updateThumbarButtons(s.playing);
					this.updateThumbProgress(s.percentage, s.playing);
				}),
			);
		} catch (error) {
			this.logger.error("Failed to initialize winControl", error);
		}
	}
	private updateThumbarButtons(isPlaying: boolean = false) {
		if (!platform.isWindows) return;
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
			this.windowContext.main.setProgressBar(isPlaying ? 1 : 0);
		} catch (error) {
			this.logger.error("Failed to update thumbar buttons", error);
		}
	}
	private updateThumbProgress(progress: number = 0, playing: boolean = false) {
		this.windowContext.main.setProgressBar(progress > 0.0 ? progress / 100 : 0, { mode: platform.isWindows ? (playing ? "normal" : "paused") : "normal" });
	}
	async OnDestroy() {
		this.windowContext.main.setThumbarButtons([]);
		this.disposeSubscriptions.forEach((d) => d());
	}
}
