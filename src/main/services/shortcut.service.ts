import { BaseProvider, OnDestroy, OnInit } from "@main/utils/baseProvider";
import { IpcContext } from "@main/utils/onIpcEvent";
import { App, globalShortcut } from "electron";

@IpcContext
export default class ShortcutService extends BaseProvider implements OnInit, OnDestroy {
  private get apiProvider() {
    return this.getProvider("api");
  }
  private get trackProvider() {
    return this.getProvider("track");
  }
  get trackState() {
    return this.trackProvider.trackState;
  }
	private readonly shortcuts: ReadonlyArray<{ accelerator: string; action: () => Promise<unknown> }> = [
		{ accelerator: "Shift+Alt+Left", action: async () => await this.apiProvider.prevTrack() },
		{ accelerator: "Shift+Alt+Right", action: async () => await this.apiProvider.nextTrack() },
		{ accelerator: "Shift+Alt+Space", action: async () => await this.apiProvider.toggleTrackPlayback() },
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