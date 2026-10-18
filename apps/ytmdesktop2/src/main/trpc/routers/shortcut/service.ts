import { AfterInit, BaseProvider, OnDestroy } from "@main/core/baseProvider";
import { trackService } from "@main/trpc/routers/track";
import {
	duplicateAcceleratorId,
	type ShortcutPlatform,
	validateGlobalAccelerator,
} from "@shared/shortcuts/accelerators";
import {
	isShortcutActionId,
	resolveShortcutBinds,
	SHORTCUT_CATALOG,
	type ShortcutActionId,
	type ShortcutBinds,
} from "@shared/shortcuts/catalog";
import { App, globalShortcut } from "electron";

export type ShortcutSetResult = { ok: true } | { ok: false; reason: string };

/** Player seek cmds take milliseconds (same as API / `trackControls.seek`). */
const SEEK_MS = 10_000;

const ACTIONS: Record<ShortcutActionId, () => Promise<unknown>> = {
	prev: () => trackService.prevTrack(),
	next: () => trackService.nextTrack(),
	togglePlay: () => trackService.toggleTrackPlayback(),
	play: () => trackService.playTrack(),
	pause: () => trackService.pauseTrack(),
	seekForward: () => trackService.forwardTrack(undefined, { time: SEEK_MS }),
	seekBackward: () => trackService.backwardTrack(undefined, { time: SEEK_MS }),
	volumeUp: () => trackService.volumeUpTrack(),
	volumeDown: () => trackService.volumeDownTrack(),
	like: () => trackService.postTrackLike(!trackService.trackState?.liked),
	dislike: () => trackService.postTrackDisLike(!trackService.trackState?.disliked),
	shuffle: () => trackService.shuffleTrack(),
	repeat: () => trackService.repeatTrack(),
};

export default class ShortcutService extends BaseProvider implements AfterInit, OnDestroy {
	private registered: string[] = [];
	private capturing = false;

	constructor(private app: App) {
		super("shortcut");
	}

	private platform(): ShortcutPlatform {
		if (process.platform === "darwin" || process.platform === "win32") return process.platform;
		return "linux";
	}

	private settings() {
		return this.getProvider("settings");
	}

	private enabled(): boolean {
		return !!this.settings().get<boolean>("shortcuts.enabled", true);
	}

	private overrides(): ShortcutBinds {
		return this.settings().get("shortcuts.binds", {}) ?? {};
	}

	list() {
		const resolved = resolveShortcutBinds(this.overrides());
		return SHORTCUT_CATALOG.map((item) => {
			const accelerator = resolved[item.id];
			const source = Object.prototype.hasOwnProperty.call(this.overrides(), item.id)
				? accelerator
					? ("custom" as const)
					: ("unbound" as const)
				: accelerator
					? ("default" as const)
					: ("unbound" as const);
			return { id: item.id, label: item.label, accelerator, defaultAccelerator: item.defaultAccelerator, source };
		});
	}

	setBind(id: string, accelerator: string | null): ShortcutSetResult {
		if (!isShortcutActionId(id)) return { ok: false, reason: "Unknown action." };
		const next = { ...this.overrides() };
		if (accelerator === null) {
			next[id] = null;
			this.settings().set("shortcuts.binds", next);
			this.settings().saveToDrive();
			return { ok: true };
		}
		const checked = validateGlobalAccelerator(accelerator, this.platform());
		if (!checked.ok) return checked;
		const duplicate = duplicateAcceleratorId(checked.parsed, resolveShortcutBinds(next), this.platform(), id);
		if (duplicate) return { ok: false, reason: `Already used by ${SHORTCUT_CATALOG.find((item) => item.id === duplicate)?.label ?? duplicate}.` };
		this.unregisterAll();
		const probeOk = globalShortcut.register(checked.accelerator, () => undefined);
		globalShortcut.unregister(checked.accelerator);
		if (!probeOk) {
			this.rebind();
			return { ok: false, reason: "Already used by the system or another app." };
		}
		next[id] = checked.accelerator;
		this.settings().set("shortcuts.binds", next);
		this.settings().saveToDrive();
		return { ok: true };
	}

	setCapturing(active: boolean) {
		if (this.capturing === active) return;
		this.capturing = active;
		if (active) this.unregisterAll();
		else this.rebind();
	}

	reset(id?: string): ShortcutSetResult {
		if (!id) {
			this.settings().set("shortcuts.binds", {});
			this.settings().saveToDrive();
			return { ok: true };
		}
		if (!isShortcutActionId(id)) return { ok: false, reason: "Unknown action." };
		const next = { ...this.overrides() };
		delete next[id];
		this.settings().set("shortcuts.binds", next);
		this.settings().saveToDrive();
		return { ok: true };
	}

	private unregisterAll() {
		for (const accelerator of this.registered) {
			globalShortcut.unregister(accelerator);
		}
		this.registered = [];
	}

	rebind() {
		this.unregisterAll();
		if (!this.enabled() || this.capturing) return;
		const resolved = resolveShortcutBinds(this.overrides());
		for (const item of SHORTCUT_CATALOG) {
			const accelerator = resolved[item.id];
			if (!accelerator) continue;
			const checked = validateGlobalAccelerator(accelerator, this.platform());
			if (!checked.ok) {
				this.logger.warn(`skip invalid shortcut ${item.id}: ${checked.reason}`);
				continue;
			}
			const ok = globalShortcut.register(checked.accelerator, () => {
				void ACTIONS[item.id]().catch((error: unknown) => {
					this.logger.error(`failed to run shortcut action: ${item.id}`, error);
				});
			});
			if (!ok) {
				this.logger.warn(`failed to register shortcut: ${checked.accelerator}`);
				continue;
			}
			this.registered.push(checked.accelerator);
		}
	}

	async AfterInit() {
		this.settings().onSettingChange(["shortcuts.enabled", "shortcuts.binds"], () => this.rebind());
		this.rebind();
	}

	async OnDestroy() {
		this.unregisterAll();
	}
}
