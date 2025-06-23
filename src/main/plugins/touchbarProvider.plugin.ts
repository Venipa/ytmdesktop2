import { platform } from "@electron-toolkit/utils";
import { BaseProvider } from "@main/utils/baseProvider";
import { IpcContext } from "@main/utils/onIpcEvent";
import { NativeImage, TouchBar } from "electron";
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
@IpcContext
export default class TouchbarProvider extends BaseProvider {
	constructor() {
		super("touchbar");
	}

	async AfterInit() {
		if (!platform.isMacOS) return;
		// Songtitle label
		const songTitle = new TouchBar.TouchBarLabel({
			label: "",
		});
		// This will store the song controls once available
		let controls: (() => void)[] = [];

		// This will store the song image once available
		const songImage: {
			icon?: NativeImage;
		} = {};
		const trackState = await this.getProvider("api").getTrackState();
		const pausePlayButton = new TouchBar.TouchBarButton({
			label: emotes.play,
			click: () => {
				this.getProvider("api")
					.toggleTrackPlayback()
					.then((playing) => {
						pausePlayButton.label = playing ? emotes.pause : emotes.play;
					});
			},
		});
		this.getProvider("track").onTrackStateChange((state) => {
			likeButton.backgroundColor = state.liked ? "#ffffff0a" : "transparent";
			dislikeButton.backgroundColor = state.disliked ? "#ffffff0a" : "transparent";
			pausePlayButton.label = state.playing ? emotes.pause : emotes.play;
		});
		const likeButton = new TouchBar.TouchBarButton({
			label: emotes.like,
			backgroundColor: trackState.liked ? "#ffffff0a" : "transparent",
			click: () => {
				this.getProvider("api")
					.postTrackLike(null, true)
					.then((liked) => {
						likeButton.backgroundColor = liked ? "#ffffff0a" : "transparent";
					});
			},
		});
		const dislikeButton = new TouchBar.TouchBarButton({
			label: emotes.dislike,
			backgroundColor: trackState.disliked ? "#ffffff0a" : "transparent",
			click: () => {
				this.getProvider("api")
					.postTrackDisLike(null, false)
					.then((disliked) => {
						dislikeButton.backgroundColor = disliked ? "#ffffff0a" : "transparent";
					});
			},
		});
		const repeatButton = new TouchBar.TouchBarButton({
			label: emotes.repeat,
			click: () => {
				this.getProvider("api")
					.repeatTrack()
					.then((repeat) => {
						repeatButton.label = repeat ? emotes.repeatOn : emotes.repeatOff;
						repeatButton.backgroundColor = repeat ? "#ffffff0a" : "transparent";
					});
			},
		});
		const shuffleButton = new TouchBar.TouchBarButton({
			label: emotes.shuffle,
			click: () => {
				this.getProvider("api")
					.shuffleTrack()
					.then((shuffle) => {
						shuffleButton.label = shuffle ? emotes.shuffleOn : emotes.shuffleOff;
						shuffleButton.backgroundColor = shuffle ? "#ffffff0a" : "transparent";
					});
			},
		});
		const buttons = new TouchBar.TouchBarSegmentedControl({
			segments: [
				new TouchBar.TouchBarButton({
					label: emotes.prev,
					click: () => {
						this.getProvider("api").prevTrack();
					},
				}),
				pausePlayButton,
				new TouchBar.TouchBarButton({
					label: emotes.next,
					click: () => {
						this.getProvider("api").nextTrack();
					},
				}),
				likeButton,
				dislikeButton,
			],
			selectedIndex: 1,
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
				buttons,
			],
		});
		this.windowContext.main.setTouchBar(touchBar);
	}
}
