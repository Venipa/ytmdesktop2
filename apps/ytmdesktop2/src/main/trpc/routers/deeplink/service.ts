import { AfterInit, BaseProvider, BeforeStart } from "@main/core/baseProvider";
import {
	findYtmdProtocolArg,
	parseYtmdProtocolUrl,
	YTMD_PROTOCOL,
} from "@shared/protocol/ytmdProtocol";
import { App } from "electron";
import path from "node:path";

/**
 * Owns `ytmd://` registration + dispatch (open-url / argv / second-instance).
 * Navigates via NavigationProvider; does not own single-instance lock.
 */
export default class DeeplinkProvider extends BaseProvider implements BeforeStart, AfterInit {
	private ready = false;
	private pendingUrl: string | null = null;
	private coldStartArgConsumed = false;

	constructor(private _app: App) {
		super("deeplink");
	}

	async BeforeStart() {
		this.registerProtocolClient();
		this._app.on("open-url", (event, url) => {
			event.preventDefault();
			void this.handle(url);
		});
		this._app.on("second-instance", (_event, commandLine) => {
			const url = findYtmdProtocolArg(commandLine);
			if (url) void this.handle(url);
		});
	}

	async AfterInit() {
		await this.flush();
	}

	/** Public entry for tests / future callers. */
	async handle(url: string): Promise<boolean> {
		const action = parseYtmdProtocolUrl(url);
		if (!action) {
			this.logger.debug("ignored deeplink", url);
			return false;
		}
		if (!this.ready) {
			this.pendingUrl = url;
			this.logger.debug("queued deeplink until ready", url);
			return true;
		}
		this.focusMainWindow();
		if (action.type === "watch") {
			this.logger.info("deeplink openWatch", action.videoId);
			await this.getProvider("navigation").openWatch(action.videoId);
		}
		return true;
	}

	private async flush() {
		const queued = this.pendingUrl;
		this.pendingUrl = null;

		if (!this.ready) {
			this.ready = true;
			const cold = !this.coldStartArgConsumed ? findYtmdProtocolArg(process.argv) : null;
			this.coldStartArgConsumed = true;
			const url = queued ?? cold;
			if (url) await this.handle(url);
			return;
		}

		if (queued) await this.handle(queued);
	}

	private registerProtocolClient() {
		try {
			if (this._app.isDefaultProtocolClient(YTMD_PROTOCOL)) return;
			if (process.defaultApp) {
				if (process.argv.length >= 2) {
					this.logger.info(`register protocol '${YTMD_PROTOCOL}' (dev)`);
					this._app.setAsDefaultProtocolClient(YTMD_PROTOCOL, process.execPath, [
						path.resolve(process.argv[1]!),
					]);
				}
				return;
			}
			this.logger.info(`register protocol '${YTMD_PROTOCOL}'`);
			this._app.setAsDefaultProtocolClient(YTMD_PROTOCOL);
		} catch (err) {
			this.logger.error("failed to register protocol client", err);
		}
	}

	private focusMainWindow() {
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
