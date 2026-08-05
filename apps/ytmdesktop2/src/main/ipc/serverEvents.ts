import { ipcMain } from "electron";
import EventEmitter from "events";

type Listener = (...args: any[]) => void;

/**
 * Main-process bus that unifies:
 * - internal main→main events (EventEmitter)
 * - renderer→main IPC (ipcMain)
 *
 * IMPORTANT: listeners registered via `on`/`once` live ONLY on the EventEmitter.
 * A one-shot ipcMain bridge forwards renderer IPC into the EE.
 * `emit` notifies EE listeners, then ipcMain-only listeners (e.g. fromIpcEvent),
 * without re-entering the bridge (which would double-fire EE handlers).
 */
class ElectronEmitter extends EventEmitter {
	private readonly bridgedChannels = new Set<string>();
	/** True while emit() is pushing into ipcMain — bridge must not bounce back to EE. */
	private forwardingFromEmit = false;

	constructor() {
		super();
	}

	private ensureIpcBridge(type: string): void {
		if (this.bridgedChannels.has(type)) return;
		this.bridgedChannels.add(type);
		ipcMain.on(type, (...args: any[]) => {
			if (this.forwardingFromEmit) return;
			super.emit(type, ...args);
		});
	}

	override on(type: string, listener: Listener): this {
		this.ensureIpcBridge(type);
		super.on(type, listener);
		return this;
	}

	override once(type: string, listener: Listener): this {
		this.ensureIpcBridge(type);
		super.once(type, listener);
		return this;
	}

	override emit(type: string, ...args: any[]): boolean {
		const eeResult = super.emit(type, ...args);
		this.forwardingFromEmit = true;
		let ipcResult = false;
		try {
			ipcResult = ipcMain.emit(type, ...args);
		} finally {
			this.forwardingFromEmit = false;
		}
		return eeResult || ipcResult;
	}

	/** EE-only emit — no ipcMain fan-out (avoids fromIpcEvent / raw ipcMain listeners). */
	emitServer(type: string, ...args: any[]): boolean {
		return super.emit(type, ...args);
	}

	/** EE-only listener — no renderer IPC bridge. */
	onServer(type: string, listener: Listener): this {
		super.on(type, listener);
		return this;
	}

	handle: typeof ipcMain.handle = (type: string, listener: Listener) => {
		return ipcMain.handle(type, listener);
	};
}

const serverMain = new ElectronEmitter();

export { serverMain };
