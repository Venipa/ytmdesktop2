import { platform } from "@electron-toolkit/utils";
import { AfterInit, BaseProvider } from "@main/utils/baseProvider";
import { IpcContext } from "@main/utils/onIpcEvent";
import { NativeImage, TouchBar, nativeImage } from "electron";
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
@IpcContext
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
			const trackApi = this.getProvider("api");
			const trackProvider = this.getProvider("track");
			const trackState = trackProvider.trackState;
			const pausePlayButton = new TouchBar.TouchBarButton({
				label: emotes.play,
				click: () => {
					trackApi.toggleTrackPlayback().then((playing) => {
						pausePlayButton.label = playing ? emotes.pause : emotes.play;
					});
				},
			});
			const likeButton = new TouchBar.TouchBarButton({
				label: emotes.like,
				backgroundColor: trackState?.liked ? emoteColors.like : emoteColorsOff.like,
				click: () => {
					trackApi.postTrackLike(null, true).then((liked) => {
						likeButton.backgroundColor = liked ? "#202020" : null;
					});
				},
			});
			const dislikeButton = new TouchBar.TouchBarButton({
				label: emotes.dislike,
				backgroundColor: trackState?.disliked ? emoteColors.dislike : emoteColorsOff.dislike,
				click: () => {
					trackApi.postTrackDisLike(null, false).then((disliked) => {
						dislikeButton.backgroundColor = disliked ? "#202020" : null;
					});
				},
			});
			const repeatButton = new TouchBar.TouchBarButton({
				label: emotes.repeat,
				click: () => {
					trackApi.repeatTrack().then((repeat) => {
						repeatButton.label = repeat ? emotes.repeatOn : emotes.repeatOff;
						repeatButton.backgroundColor = repeat ? emoteColors.repeat : emoteColorsOff.repeat;
					});
				},
			});
			const shuffleButton = new TouchBar.TouchBarButton({
				label: emotes.shuffle,
				click: () => {
					trackApi.shuffleTrack().then((shuffle) => {
						shuffleButton.label = shuffle ? emotes.shuffleOn : emotes.shuffleOff;
						shuffleButton.backgroundColor = shuffle ? emoteColors.shuffle : emoteColorsOff.shuffle;
					});
				},
			});
			const buttonHandlers = [
				() => trackApi.prevTrack(),
				() =>
					trackApi.toggleTrackPlayback().then((playing) => {
						pausePlayButton.label = playing ? emotes.pause : emotes.play;
					}),
				() => trackApi.nextTrack(),
				() =>
					trackApi.postTrackLike(null, true).then((liked) => {
						likeButton.backgroundColor = liked ? emoteColors.like : emoteColorsOff.like;
					}),
				() =>
					trackApi.postTrackDisLike(null, true).then((disliked) => {
						dislikeButton.backgroundColor = disliked ? emoteColors.dislike : emoteColorsOff.dislike;
					}),
			];
			const buttons = new TouchBar.TouchBarSegmentedControl({
				segments: [
					new TouchBar.TouchBarButton({
						label: emotes.prev,
						click: () => {
							trackApi.prevTrack();
						},
					}),
					pausePlayButton,
					new TouchBar.TouchBarButton({
						label: emotes.next,
						click: () => {
							trackApi.nextTrack();
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
					const duration = trackProvider.trackState?.duration ?? 0;
					if (duration <= 0) return;
					const newValue = Math.floor((value / 100) * duration);
					trackApi.seekTrack(null, { time: newValue * 1000, type: "seek" });
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
			trackProvider.onTrackStateChange(
				(state) => {
					likeButton.backgroundColor = state.liked ? emoteColors.like : emoteColorsOff.like;
					dislikeButton.backgroundColor = state.disliked ? emoteColors.dislike : emoteColorsOff.dislike;
					pausePlayButton.label = state.playing ? emotes.pause : emotes.play;
					this.windowContext.main.setTouchBar(touchBar);
				},
				{ debounce: 1000 },
			);
			trackProvider.onTrackStateChange(async (state) => {
				const newValue = clamp((state.progress / state.duration) * 100, 0, 100);
				trackSlider.value = Math.floor(newValue);
			});
			trackProvider.onTrackChange(async (track) => {
				songTitle.label = track.video.title;
				this.logger.debug("TouchbarProvider onTrackChange", songTitle.label, track.video.thumbnail.thumbnails?.[0]?.url);
				const buffer = track.video.thumbnail.thumbnails?.[0]?.url && (await fetch(track.video.thumbnail.thumbnails[0].url).catch(() => null));
				songImage.icon = (buffer ? nativeImage.createFromBuffer(Buffer.from(await buffer.arrayBuffer())) : nativeImage.createFromPath(appIconPath)).resize({
					height: 23,
				});
				const { liked, disliked } = await trackApi.getTrackState();
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
