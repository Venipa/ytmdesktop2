import streamDeck, { action, type KeyDownEvent, SingletonAction, type WillAppearEvent } from "@elgato/streamdeck";
import { type GlobalSettings, YtmApiClient } from "../api";

const api = new YtmApiClient(async () => ((await streamDeck.settings.getGlobalSettings()) as GlobalSettings) ?? {});

async function runCommand(ev: KeyDownEvent, path: string, body?: unknown): Promise<void> {
	try {
		await api.post(path, body);
	} catch (err) {
		streamDeck.logger.error("ytm command failed", path, err);
		await ev.action.showAlert();
	}
}

@action({ UUID: "com.venipa.ytmdesktop2.play-pause" })
export class PlayPauseAction extends SingletonAction {
	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await runCommand(ev, "/track/toggle-play-state");
	}
}

@action({ UUID: "com.venipa.ytmdesktop2.next" })
export class NextAction extends SingletonAction {
	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await runCommand(ev, "/track/next");
	}
}

@action({ UUID: "com.venipa.ytmdesktop2.prev" })
export class PrevAction extends SingletonAction {
	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await runCommand(ev, "/track/prev");
	}
}

@action({ UUID: "com.venipa.ytmdesktop2.like" })
export class LikeAction extends SingletonAction {
	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await runCommand(ev, "/track/like", true);
	}
}

@action({ UUID: "com.venipa.ytmdesktop2.dislike" })
export class DislikeAction extends SingletonAction {
	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await runCommand(ev, "/track/dislike", true);
	}
}

@action({ UUID: "com.venipa.ytmdesktop2.shuffle" })
export class ShuffleAction extends SingletonAction {
	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await runCommand(ev, "/track/shuffle");
	}
}

@action({ UUID: "com.venipa.ytmdesktop2.repeat" })
export class RepeatAction extends SingletonAction {
	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await runCommand(ev, "/track/repeat");
	}
}

@action({ UUID: "com.venipa.ytmdesktop2.volume-up" })
export class VolumeUpAction extends SingletonAction {
	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await runCommand(ev, "/track/volume-up", { amount: 5 });
	}
}

@action({ UUID: "com.venipa.ytmdesktop2.volume-down" })
export class VolumeDownAction extends SingletonAction {
	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await runCommand(ev, "/track/volume-down", { amount: 5 });
	}
}

@action({ UUID: "com.venipa.ytmdesktop2.track-info" })
export class TrackInfoAction extends SingletonAction {
	private timer: ReturnType<typeof setInterval> | undefined;

	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		await this.refresh(ev);
		this.timer = setInterval(() => void this.refresh(ev), 3000);
	}

	override onWillDisappear(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await this.refresh(ev);
	}

	private async refresh(ev: WillAppearEvent | KeyDownEvent): Promise<void> {
		try {
			const track = await api.getTrack();
			const title = track?.title ? `${track.title}${track.author ? `\n${track.author}` : ""}` : "No track";
			await ev.action.setTitle(title);
		} catch {
			await ev.action.setTitle("Offline");
		}
	}
}

export { api };
