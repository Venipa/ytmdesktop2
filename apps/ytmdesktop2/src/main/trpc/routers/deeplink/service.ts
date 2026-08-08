import { AfterInit, BaseProvider, BeforeStart } from "@main/core/baseProvider";
import { createAppDialogWindow } from "@main/windows/windowUtils";
import { type YtmdParsed, YtmdLink } from "@shared/protocol/ytmdProtocol";
import { stripUndefined } from "@shared/utils/object";
import { App, BrowserWindow } from "electron";
import path from "node:path";

type DeeplinkAction = "close" | "play" | "queue" | "open";

const DIALOG_WIDTH = 420;
const DIALOG_HEIGHT = 300;

/**
 * Registers `ytmd://`. Mode from `player.deepLinkOpen`: ask (dialog) or play (instant).
 * Single-instance lock stays on AppProvider.
 */
export default class DeeplinkProvider extends BaseProvider implements BeforeStart, AfterInit {
	private ready = false;
	private queue: string | null = null;
	private busy = false;
	private dialog: BrowserWindow | null = null;

	constructor(private _app: App) {
		super("deeplink");
	}

	async BeforeStart() {
		this.register();
		this._app.on("open-url", (event, url) => {
			event.preventDefault();
			void this.enqueue(url);
		});
		this._app.on("second-instance", (_event, argv) => {
			const url = YtmdLink.fromArgv(argv);
			if (url) void this.enqueue(url);
		});
	}

	async AfterInit() {
		this.ready = true;
		if (!this.queue) this.queue = YtmdLink.fromArgv(process.argv);
		await this.drain();
	}

	private async enqueue(url: string) {
		if (!YtmdLink.parse(url)) {
			this.logger.debug("ignored deeplink", url);
			return;
		}
		this.queue = url;
		if (this.ready) await this.drain();
	}

	private async drain() {
		if (!this.ready || this.busy) return;
		const url = this.queue;
		this.queue = null;
		if (!url) return;

		const pending = YtmdLink.parse(url);
		if (!pending) return;

		this.busy = true;
		try {
			this.focusMain();
			await this.handleLink(pending);
		} catch (err) {
			this.logger.error("deeplink failed", url, err);
		} finally {
			this.busy = false;
			if (this.queue) void this.drain();
		}
	}

	private async handleLink(pending: YtmdParsed) {
		// Explicit `/play` on playlist → start immediately (link intent).
		if (pending.type === "playlist" && pending.play) {
			await this.applyChoice("play", pending);
			return;
		}

		const mode = this.getProvider("settings").get<"ask" | "play">("player.deepLinkOpen", "ask");
		if (mode === "play") {
			await this.applyChoice(pending.type === "watch" ? "play" : "open", pending);
			return;
		}
		await this.prompt(pending);
	}

	/** Open confirm dialog; resolve after action / window close. */
	private prompt(pending: YtmdParsed): Promise<void> {
		const parent = this.windowContext?.main;
		if (!parent || parent.isDestroyed()) {
			this.logger.warn("deeplink prompt skipped — no main window");
			return Promise.resolve();
		}

		const shareUrl = YtmdLink.format(pending);
		const qs = new URLSearchParams(
			stripUndefined({
				kind: pending.type,
				url: shareUrl,
				...(pending.type === "watch"
					? { videoId: pending.videoId, playlistId: pending.playlistId }
					: {}),
				...(pending.type === "playlist" ? { playlistId: pending.playlistId, play: pending.play ? "1" : "0" } : {}),
				...(pending.type === "channel"
					? { channelId: pending.channelId, handle: pending.handle }
					: {}),
			}),
		);

		return new Promise<void>((resolve) => {
			let settled = false;
			const finish = (action: DeeplinkAction) => {
				if (settled) return;
				settled = true;
				const win = this.dialog;
				this.dialog = null;
				if (win && !win.isDestroyed()) win.close();
				void this.applyChoice(action, pending).finally(resolve);
			};

			void createAppDialogWindow<DeeplinkAction>({
				parent,
				path: `/deeplink?${qs.toString()}`,
				width: DIALOG_WIDTH,
				height: DIALOG_HEIGHT,
				minWidth: DIALOG_WIDTH,
				maxWidth: DIALOG_WIDTH,
				minHeight: DIALOG_HEIGHT,
				maxHeight: DIALOG_HEIGHT,
				maximizeable: false,
				minimizeable: false,
				showTaskBar: true,
				top: true,
				show: false,
				onResponse: (action) => finish(action),
			})
				.then((win) => {
					if (settled) {
						if (!win.isDestroyed()) win.close();
						return;
					}
					this.dialog = win;
					win.on("closed", () => {
						this.dialog = null;
						if (!settled) {
							settled = true;
							resolve();
						}
					});
					win.show();
					win.focus();
				})
				.catch((err) => {
					this.logger.error("deeplink dialog open failed", err);
					if (!settled) {
						settled = true;
						resolve();
					}
				});
		});
	}

	private async applyChoice(action: DeeplinkAction, pending: YtmdParsed) {
		const nav = this.getProvider("navigation");
		try {
			if (action === "close") {
				this.logger.debug("deeplink cancelled", pending.type);
				return;
			}

			if (pending.type === "watch") {
				if (action === "play") {
					this.logger.info("deeplink play", pending.videoId, pending.playlistId ?? null);
					await nav.openWatch(pending.videoId, pending.playlistId);
					return;
				}
				if (action === "queue") {
					this.logger.info("deeplink queueAdd", pending.videoId, pending.playlistId ?? null);
					// queueAdd accepts videoId XOR playlistId — never both (YTM 400 browse_id).
					await nav.queueAdd(pending.videoId);
					return;
				}
				return;
			}

			if (pending.type === "playlist") {
				if (action === "play") {
					this.logger.info("deeplink playlist play", pending.playlistId);
					await nav.openPlaylist(pending.playlistId, true);
					return;
				}
				if (action === "open") {
					this.logger.info("deeplink playlist open", pending.playlistId);
					await nav.openPlaylist(pending.playlistId, false);
					return;
				}
				return;
			}

			if (pending.type === "channel" && (action === "open" || action === "play")) {
				this.logger.info("deeplink channel open", pending.channelId ?? pending.handle);
				await nav.openChannel({ channelId: pending.channelId, handle: pending.handle });
			}
		} catch (err) {
			this.logger.error("deeplink action failed", action, pending, err);
		}
	}

	private register() {
		try {
			if (process.defaultApp) {
				if (process.argv.length >= 2) {
					this.logger.info(`register ${YtmdLink.scheme} (dev)`);
					this._app.setAsDefaultProtocolClient(YtmdLink.scheme, process.execPath, [
						path.resolve(process.argv[1]!),
					]);
				}
				return;
			}
			if (!this._app.isDefaultProtocolClient(YtmdLink.scheme)) {
				this.logger.info(`register ${YtmdLink.scheme}`);
				this._app.setAsDefaultProtocolClient(YtmdLink.scheme);
			}
		} catch (err) {
			this.logger.error("protocol register failed", err);
		}
	}

	private focusMain() {
		const wnd = this.windowContext?.main;
		if (!wnd || wnd.isDestroyed()) return;
		if (wnd.isMinimized()) wnd.restore();
		if (!wnd.isVisible()) {
			wnd.show();
			wnd.setSkipTaskbar(false);
		}
		wnd.focus();
	}
}
