import { platform } from "@electron-toolkit/utils";
import { AfterInit, BaseProvider } from "@main/core/baseProvider";
import { createMainCaller } from "@main/trpc/caller";
import { trackService } from "@main/trpc/routers/track";
import { NativeImage, nativeImage, TouchBar } from "electron";
import { clamp } from "lodash-es";
import appIconPath from "~/build/favicon.ico?asset";

const emotes = {
	pause: "⏸️",
	play: "▶️",
	like: "👍",
	dislike: "👎",
	prev: "⏮️",
	next: "⏭️",
	repeat: "🔁",
	shuffle: "🔀",
	shuffleOn: "🔀",
	shuffleOff: "🔀",
	repeatOn: "🔂",
	repeatOff: "🔁",
	volume: "🔊",
	mute: "🔇",
	unmute: "🔊",
	repeatOne: "🔂",
};
const emoteColors = {
	like: "#202020",
	dislike: "#202020",
	repeat: "#202020",
	shuffle: "#202020",
	volume: "#202020",
};
const emoteColorsOff = {
	like: null,
	dislike: null,
	repeat: null,
	shuffle: null,
	volume: null,
};
export default class TouchbarProvider extends BaseProvider implements AfterInit {
	constructor() {
		super("touchbar");
	}

	async AfterInit() {
		this.logger.debug("TouchbarProvider AfterInit", platform.isMacOS);
		if (!platform.isMacOS) return;
		try {
			// Songtitle label
			const songTitle = new TouchBar.TouchBarLabel({
				label: "",
			});

			// This will store the song image once available
			const songImage: {
				icon?: NativeImage;
			} = {};
			const track = () => createMainCaller().track;
			const trackState = trackService.trackState;
			const pausePlayButton = new TouchBar.TouchBarButton({
				label: emotes.play,
				click: () => {
					track()
						.togglePlay()
						.then((res) => {
							pausePlayButton.label = res?.isPlaying ? emotes.pause : emotes.play;
						});
				},
			});
			const likeButton = new TouchBar.TouchBarButton({
				label: emotes.like,
				backgroundColor: trackState?.liked ? emoteColors.like : emoteColorsOff.like,
				click: () => {
					track()
						.like(true)
						.then((liked) => {
							likeButton.backgroundColor = liked ? "#202020" : null;
						});
				},
			});
			const dislikeButton = new TouchBar.TouchBarButton({
				label: emotes.dislike,
				backgroundColor: trackState?.disliked ? emoteColors.dislike : emoteColorsOff.dislike,
				click: () => {
					track()
						.dislike(false)
						.then((disliked) => {
							dislikeButton.backgroundColor = disliked ? "#202020" : null;
						});
				},
			});
			const repeatButton = new TouchBar.TouchBarButton({
				label: emotes.repeat,
				click: () => {
					track()
						.repeat()
						.then((repeat) => {
							const on = !!repeat;
							repeatButton.label = on ? emotes.repeatOn : emotes.repeatOff;
							repeatButton.backgroundColor = on ? emoteColors.repeat : emoteColorsOff.repeat;
						});
				},
			});
			const shuffleButton = new TouchBar.TouchBarButton({
				label: emotes.shuffle,
				click: () => {
					track()
						.shuffle()
						.then((shuffle) => {
							const on = !!shuffle;
							shuffleButton.label = on ? emotes.shuffleOn : emotes.shuffleOff;
							shuffleButton.backgroundColor = on ? emoteColors.shuffle : emoteColorsOff.shuffle;
						});
				},
			});
			const buttonHandlers = [
				() => track().prev(),
				() =>
					track()
						.togglePlay()
						.then((res) => {
							pausePlayButton.label = res?.isPlaying ? emotes.pause : emotes.play;
						}),
				() => track().next(),
				() =>
					track()
						.like(true)
						.then((liked) => {
							likeButton.backgroundColor = liked ? emoteColors.like : emoteColorsOff.like;
						}),
				() =>
					track()
						.dislike(true)
						.then((disliked) => {
							dislikeButton.backgroundColor = disliked ? emoteColors.dislike : emoteColorsOff.dislike;
						}),
			];
			const buttons = new TouchBar.TouchBarSegmentedControl({
				segments: [
					new TouchBar.TouchBarButton({
						label: emotes.prev,
						click: () => {
							void track().prev();
						},
					}),
					pausePlayButton,
					new TouchBar.TouchBarButton({
						label: emotes.next,
						click: () => {
							void track().next();
						},
					}),
					likeButton,
					dislikeButton,
				],
				change: (selectedIndex) => {
					Promise.resolve(buttonHandlers[selectedIndex]?.()).then(() => {
						this.windowContext.main.setTouchBar(touchBar);
					});
				},
				mode: "buttons",
				segmentStyle: "automatic",
			});
			const trackSlider = new TouchBar.TouchBarSlider({
				minValue: 0,
				maxValue: 100,
				value: 0,
				change: (value) => {
					this.logger.debug("TouchbarProvider trackSlider change", value);
					const duration = trackService.trackState?.duration ?? 0;
					if (duration <= 0) return;
					const newValue = Math.floor((value / 100) * duration);
					void track().seek({ time: newValue * 1000, type: "seek" });
					this.logger.debug("TouchbarProvider trackSlider change", newValue, duration);
				},
			});
			const touchBar = new TouchBar({
				items: [
					new TouchBar.TouchBarScrubber({
						items: [songImage, songTitle],
						continuous: false,
					}),

					new TouchBar.TouchBarSpacer({
						size: "flexible",
					}),
					trackSlider,
					new TouchBar.TouchBarSpacer({
						size: "flexible",
					}),
					buttons,
				],
			});
			this.logger.debug("Setting touchbar", !!touchBar);
			trackService.onTrackStateChange(
				(state) => {
					likeButton.backgroundColor = state.liked ? emoteColors.like : emoteColorsOff.like;
					dislikeButton.backgroundColor = state.disliked ? emoteColors.dislike : emoteColorsOff.dislike;
					pausePlayButton.label = state.playing ? emotes.pause : emotes.play;
					this.windowContext.main.setTouchBar(touchBar);
				},
				{ debounce: 1000 },
			);
			trackService.onTrackStateChange(async (state) => {
				const newValue = clamp((state.progress / state.duration) * 100, 0, 100);
				trackSlider.value = Math.floor(newValue);
			});
			trackService.onTrackChange(async (nextTrack) => {
				songTitle.label = nextTrack.video.title;
				this.logger.debug("TouchbarProvider onTrackChange", songTitle.label, nextTrack.video.thumbnail.thumbnails?.[0]?.url);
				const buffer = nextTrack.video.thumbnail.thumbnails?.[0]?.url && (await fetch(nextTrack.video.thumbnail.thumbnails[0].url).catch(() => null));
				songImage.icon = (buffer ? nativeImage.createFromBuffer(Buffer.from(await buffer.arrayBuffer())) : nativeImage.createFromPath(appIconPath)).resize({
					height: 23,
				});
				const { liked, disliked } = (await track().state()) ?? {};
				likeButton.backgroundColor = liked ? emoteColors.like : emoteColorsOff.like;
				dislikeButton.backgroundColor = disliked ? emoteColors.dislike : emoteColorsOff.dislike;
				this.windowContext.main.setTouchBar(touchBar);
			});
			this.windowContext.main.setTouchBar(touchBar);
		} catch (error) {
			this.logger.error("TouchbarProvider error", error);
		}
	}
}
