import preloadRoot from "./base";
import { YOUTUBE_HOST_PREFIX, createContextExposer, createHostDetector, createIpcReporter, initializeWithDomLoaded } from "./utils";

// Initialize utilities
const contextExposer = createContextExposer();
const reportLoginSuccess = createIpcReporter("g-login-success");
const isYoutubeWindow = createHostDetector(YOUTUBE_HOST_PREFIX);

// Initialize login functionality
initializeWithDomLoaded(() => {
	if (isYoutubeWindow()) reportLoginSuccess();
}, preloadRoot);

// Expose API to window
contextExposer.expose("ytdapi", {
	isYoutubeWindow: isYoutubeWindow(),
	api: preloadRoot.api,
	process: preloadRoot.process,
});
