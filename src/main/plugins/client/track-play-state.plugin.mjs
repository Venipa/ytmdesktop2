export const meta = {
	name: "Track play state",
	description: "Track the play state of the player",
	author: "Venipa <https://github.com/Venipa>",
	version: "1.0.0",
	enabled: true,
};

export const afterInit = () => {
	window.domUtils.ensureDomLoaded(() => {
		const playerApi = window.domUtils.playerApi();
		const isPlaying = () => playerApi.getPlayerState() === 1;
		playerApi.addEventListener(
			"onVideoProgress",
			(progress) => {
				window.api.emit("track-play-state", isPlaying(), progress);
			},
			{ passive: true },
		);
		// const videoDataChangeLoadedType = ["dataupdated", "dataloaded"]
		// playerApi.addEventListener("onVideoDataChange", ev => {
		//   if (ev.playertype !== 1 || !videoDataChangeLoadedType.includes(ev.type)) return;

		//   window.api.emit(IPC_EVENT_NAMES.TRACK_PLAYSTATE, isPlaying(), 0);
		// })
	});
};

