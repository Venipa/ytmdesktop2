import { createRoot } from "react-dom/client";
import { createEmbedHttpClient } from "../client/http";
import { parseEmbedFlags, parseEmbedToken } from "../flags";
import { NowPlayingWidget } from "../widgets/now-playing";
import type { NowPlayingViewModel } from "../types";
import { createElement, useEffect, useState } from "react";

function App() {
	const params = new URLSearchParams(window.location.search);
	const flags = parseEmbedFlags(params);
	const token = parseEmbedToken(params);
	const [track, setTrack] = useState<NowPlayingViewModel | null>(null);
	const [status, setStatus] = useState<string | null>("Connecting…");

	useEffect(() => {
		const fill = flags.layout === "fullscreen";
		const bg = fill ? "#0a0a0c" : flags.transparent ? "transparent" : "#0c0c0e";
		document.documentElement.style.background = bg;
		document.body.style.background = bg;
		document.body.style.margin = "0";
		document.body.style.overflow = "hidden";
		document.documentElement.style.height = fill ? "100%" : "";
		document.body.style.height = fill ? "100%" : "";
		const root = document.getElementById("root");
		if (root) {
			root.style.height = fill ? "100%" : "";
			root.style.width = fill ? "100%" : "";
		}
	}, [flags.transparent, flags.layout]);

	useEffect(() => {
		const baseUrl = `${window.location.protocol}//${window.location.host}`;
		const client = createEmbedHttpClient({
			baseUrl,
			token,
			onTrack: setTrack,
			onStatus: setStatus,
		});
		return () => client.stop();
	}, [token]);

	return createElement(NowPlayingWidget, { track, flags, status });
}

const rootEl = document.getElementById("root");
if (rootEl) {
	createRoot(rootEl).render(createElement(App));
}
