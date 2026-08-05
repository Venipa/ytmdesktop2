import { BaseProvider, OnDestroy, OnInit } from "@main/core/baseProvider";
import { createMainCaller } from "@main/trpc/caller";
import { trackService } from "@main/trpc/routers/track";
import { App, globalShortcut } from "electron";

export default class ShortcutService extends BaseProvider implements OnInit, OnDestroy {
	get trackState() {
		return trackService.trackState;
	}
	private readonly shortcuts: ReadonlyArray<{ accelerator: string; action: () => Promise<unknown> }> = [
		{ accelerator: "Shift+Alt+Left", action: async () => await createMainCaller().track.prev() },
		{ accelerator: "Shift+Alt+Right", action: async () => await createMainCaller().track.next() },
		{ accelerator: "Shift+Alt+Space", action: async () => await createMainCaller().track.togglePlay() },
	];

	constructor(private app: App) {
		super("shortcut");
	}

	async OnInit() {
		const registerShortcuts = () => {
			for (const { accelerator, action } of this.shortcuts) {
				const isRegistered = globalShortcut.register(accelerator, () => {
					void action().catch((error: unknown) => {
						this.logger.error(`failed to run shortcut action: ${accelerator}`, error);
					});
				});
				if (!isRegistered) {
					this.logger.warn(`failed to register shortcut: ${accelerator}`);
				}
			}
		};

		if (this.app.isReady()) {
			registerShortcuts();
			return;
		}
	}

	async OnDestroy() {
		for (const { accelerator } of this.shortcuts) {
			globalShortcut.unregister(accelerator);
		}
	}
}
