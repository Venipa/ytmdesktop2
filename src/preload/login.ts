import { contextBridge, ipcRenderer } from "electron";
import preloadRoot from "./base";

(() => {
	function reportLoginSuccess() {
		ipcRenderer.send("g-login-success");
	}
	const prefixHost = "music.youtube";

	const isYoutubeWindow = () => window && document.location.host.indexOf(prefixHost) === 0;
	preloadRoot.domUtils.ensureDomLoaded(() => {
		if (isYoutubeWindow()) reportLoginSuccess();
	});
	contextBridge.exposeInMainWorld("ytdapi", {
		isYoutubeWindow: isYoutubeWindow(),
		api: preloadRoot.api,
		process: preloadRoot.process,
	});
})();
