import streamDeck from "@elgato/streamdeck";
import {
	DislikeAction,
	LikeAction,
	NextAction,
	PlayPauseAction,
	PrevAction,
	RepeatAction,
	ShuffleAction,
	TrackInfoAction,
	VolumeDownAction,
	VolumeUpAction,
	api,
} from "./actions/controls";
import type { GlobalSettings } from "./api";

streamDeck.logger.setLevel("info");

streamDeck.actions.registerAction(new PlayPauseAction());
streamDeck.actions.registerAction(new NextAction());
streamDeck.actions.registerAction(new PrevAction());
streamDeck.actions.registerAction(new LikeAction());
streamDeck.actions.registerAction(new DislikeAction());
streamDeck.actions.registerAction(new ShuffleAction());
streamDeck.actions.registerAction(new RepeatAction());
streamDeck.actions.registerAction(new VolumeUpAction());
streamDeck.actions.registerAction(new VolumeDownAction());
streamDeck.actions.registerAction(new TrackInfoAction());

async function getSettings(): Promise<GlobalSettings> {
	return ((await streamDeck.settings.getGlobalSettings()) as GlobalSettings) ?? {};
}

async function pushSettings(): Promise<void> {
	await streamDeck.ui.sendToPropertyInspector({
		event: "settings",
		settings: await getSettings(),
	});
}

streamDeck.ui.onSendToPlugin(async (ev) => {
	const raw = ev.payload;
	const payload =
		typeof raw === "string"
			? { event: raw }
			: ((raw as { event?: string; host?: string; port?: number } | null | undefined) ?? undefined);
	if (!payload?.event) return;

	if (payload.event === "getSettings") {
		await pushSettings();
		return;
	}

	if (payload.event === "saveSettings") {
		const current = await getSettings();
		const next: GlobalSettings = {
			...current,
			host: payload.host || current.host || "127.0.0.1",
			port: Number(payload.port) || current.port || 13091,
		};
		await streamDeck.settings.setGlobalSettings(next);
		const ping = await api.ping();
		await streamDeck.settings.setGlobalSettings({
			...next,
			status: ping.ok ? (ping.authRequired ? "API online (auth required)" : "API online") : `Offline: ${ping.error ?? "unreachable"}`,
		});
		await pushSettings();
		return;
	}

	if (payload.event === "authorize") {
		await api.authorize(async (partial) => {
			const current = await getSettings();
			await streamDeck.settings.setGlobalSettings({ ...current, ...partial });
			await pushSettings();
		});
		await pushSettings();
	}
});

streamDeck.connect();
