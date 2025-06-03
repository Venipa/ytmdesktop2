export const meta = {
	name: "Track info watcher",
	description: "Watch for track info changes",
	author: "Venipa <https://github.com/Venipa>",
	version: "1.0.0",
	enabled: true,
};

export const afterInit = () => {
	const videoDataChangeLoadedType = ["dataupdated", "dataloaded", "newdata"];
	window.domUtils.ensureDomLoaded(() => {
		const playerApi = window.domUtils.playerApi();
		playerApi.addEventListener(
			"onVideoDataChange",
			(ev) => {
				console.log("onVideoDataChange", ev);
				if (ev.playertype !== 1 || !videoDataChangeLoadedType.includes(ev.type)) return;
				const videoData = playerApi.getPlayerResponse();
				if (!videoData) return; // check if newdata has fetched
				const requestData = {
					video: videoData.videoDetails,
					context: (videoData.microformat && videoData.microformat.microformatDataRenderer) || null,
				};
				window.ipcRenderer.emit("track:info-req", requestData);
			},
			{ passive: true },
		);
	});
};

