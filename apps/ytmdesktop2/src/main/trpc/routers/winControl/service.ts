import { platform } from "@electron-toolkit/utils";
import { AfterInit, BaseProvider, OnDestroy } from "@main/core/baseProvider";
import { getNativeImage } from "@main/domain/imageUtils";
import { createMainCaller } from "@main/trpc/caller";
import { trackService } from "@main/trpc/routers/track";
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
	private _settingsBound = false;
	private get settingsProvider() {
		return this.getProvider("settings");
	}
	async AfterInit() {
		if (!this._settingsBound) {
			this._settingsBound = true;
			this.settingsProvider.onSettingChange("app.enableTaskbarProgress", (value, prevValue) =>
				void this.__onSettingsUpdate("app.enableTaskbarProgress", value as boolean, prevValue as boolean),
			);
		}
		try {
			if (platform.isWindows) {
				this.updateThumbarButtons(trackService.playing);
			}
			const enableTaskbarProgress = this.settingsProvider.instance.app.enableTaskbarProgress;
			const trackState = trackService.trackState;
			if (enableTaskbarProgress) this.updateThumbProgress(trackState?.percentage ?? 0, trackState?.playing ?? false);
			this.disposeSubscriptions.push(
				trackService.onTrackStateChange((s) => {
					if (s.eventType === "state" && platform.isWindows) this.updateThumbarButtons(s.playing);
					if (enableTaskbarProgress) this.updateThumbProgress(s.percentage, s.playing);
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
					click: () => void createMainCaller().track.prev(),
				},
				{
					tooltip: "Play/Pause",
					// Update icon based on play state
					icon: !isPlaying ? PlayIcon : PauseIcon,
					click: () => void createMainCaller().track.togglePlay(),
				},
				{
					tooltip: "Next",
					icon: NextIcon,
					click: () => void createMainCaller().track.next(),
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
		this.disposeEvents();
	}
	private disposeEvents() {
		this.disposeSubscriptions.forEach((d) => d());
	}
	private async __onSettingsUpdate(key: string, value: boolean, prevValue: boolean) {
		if (!value && prevValue) {
			this.windowContext.main.setProgressBar(-1);
			this.disposeEvents();
		} else if (value && !prevValue) await this.AfterInit();
	}
}
