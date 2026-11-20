import { randomUUID } from "node:crypto";
import EventEmitter from "node:events";
import { type DiscordActivity } from "@main/lib/discord-rpc/discord-rpc";
import { createLogger } from "@shared/utils/console";
import IPCClient, { type IPCFrame, OPCode } from "./ipc";
import { getIPCPath } from "./ipc-path";

const log = createLogger("Lib:DiscordRPC.Client");

const PROCESS_PID = process?.pid ?? 0;
/** Discord listens on discord-ipc-0..9. */
const MAX_PIPE_IDS = 10;
const READY_TIMEOUT_MS = 5_000;
const REQUEST_TIMEOUT_MS = 10_000;

function limitText(str: string, limit = 128, minimum = 2) {
	if (str.length > limit) return str.substring(0, limit - 3) + "...";
	if (str.length < minimum) return str.padEnd(minimum, "​");
	return str;
}

/** Discord rejects text fields outside 2..128 chars. */
function limitActivityText(activity: DiscordActivity): DiscordActivity {
	return {
		...activity,
		details: activity.details && limitText(activity.details),
		state: activity.state && limitText(activity.state),
		assets: activity.assets && {
			...activity.assets,
			large_text: activity.assets.large_text && limitText(activity.assets.large_text),
			small_text: activity.assets.small_text && limitText(activity.assets.small_text),
		},
	};
}

type PendingRequest = { resolve: (data: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout };

/** Discord RPC over local IPC. Emits `close` / `error` only for a connection that reached READY. */
export default class DiscordClient extends EventEmitter {
	private ipc = new IPCClient();
	private connected = false;
	private destroyed = false;
	private connecting: Promise<void> | null = null;
	private settleReady: ((ok: boolean) => void) | null = null;
	private requests = new Map<string, PendingRequest>();
	private currentActivity: DiscordActivity | undefined;

	constructor(private clientId: string) {
		super();
		this.ipc.on("frame", (frame: IPCFrame) => this.onFrame(frame));
		this.ipc.on("close", () => this.onClose());
		this.ipc.on("error", (error: Error) => {
			if (this.connected) this.emit("error", error);
		});
	}

	get presence() {
		return this.currentActivity;
	}

	get isConnected() {
		return this.connected && !this.destroyed;
	}

	public connect(): Promise<void> {
		if (this.destroyed) return Promise.reject(new Error("DiscordClient destroyed"));
		if (this.connected) return Promise.resolve();
		this.connecting ??= this.openFirstPipe().finally(() => {
			this.connecting = null;
		});
		return this.connecting;
	}

	private async openFirstPipe() {
		for (let id = 0; id < MAX_PIPE_IDS; id++) {
			if (this.destroyed) throw new Error("DiscordClient connect aborted");
			const ipcPath = getIPCPath(id);
			if (!(await this.ipc.connect(ipcPath))) continue;
			log.debug("pipe open at", ipcPath);
			if (await this.handshake()) {
				this.connected = true;
				return;
			}
			this.ipc.destroy();
		}
		throw new Error(this.destroyed ? "DiscordClient connect aborted" : "Failed to connect to Discord IPC");
	}

	/** Resolves true on DISPATCH READY; false on close, CLOSE op or timeout. */
	private handshake(): Promise<boolean> {
		return new Promise((resolve) => {
			const timer = setTimeout(() => this.settleReady?.(false), READY_TIMEOUT_MS);
			this.settleReady = (ok) => {
				clearTimeout(timer);
				this.settleReady = null;
				resolve(ok);
			};
			if (!this.ipc.send({ v: 1, client_id: this.clientId }, OPCode.HANDSHAKE)) this.settleReady(false);
		});
	}

	private onFrame({ op, json }: IPCFrame) {
		switch (op) {
			case OPCode.PING:
				this.ipc.send(json, OPCode.PONG);
				return;
			case OPCode.CLOSE:
				log.warn("discord closed the connection", json?.code, json?.message);
				this.ipc.destroy();
				this.onClose();
				return;
			case OPCode.FRAME: {
				if (json?.cmd === "DISPATCH" && json.evt === "READY") return void this.settleReady?.(true);
				const request = typeof json?.nonce === "string" ? this.requests.get(json.nonce) : undefined;
				if (!request) return;
				this.requests.delete(json.nonce);
				clearTimeout(request.timer);
				if (json.evt === "ERROR") request.reject(new Error(`${json.data?.code}: ${json.data?.message}`));
				else request.resolve(json.data);
			}
		}
	}

	private onClose() {
		this.settleReady?.(false);
		this.rejectRequests(new Error("Discord IPC closed"));
		if (!this.connected) return;
		this.connected = false;
		this.emit("close");
	}

	/** No error = drop silently (teardown: the last clearActivity is already written). */
	private rejectRequests(error?: Error) {
		for (const { reject, timer } of this.requests.values()) {
			clearTimeout(timer);
			if (error) reject(error);
		}
		this.requests.clear();
	}

	/** Sends a command and resolves with Discord's reply for its nonce. */
	private request(cmd: string, args: Record<string, unknown>): Promise<unknown> {
		if (!this.isConnected) return Promise.reject(new Error("Discord not connected"));
		const nonce = randomUUID();
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.requests.delete(nonce);
				reject(new Error(`Discord ${cmd} timed out`));
			}, REQUEST_TIMEOUT_MS);
			this.requests.set(nonce, { resolve, reject, timer });
			if (!this.ipc.send({ cmd, args, nonce })) {
				this.requests.delete(nonce);
				clearTimeout(timer);
				reject(new Error("Discord IPC not writable"));
			}
		});
	}

	public setActivity(activity: DiscordActivity) {
		if (!this.isConnected) return;
		const next = limitActivityText(activity);
		if (this.currentActivity?.details !== next.details) log.debug("activity set", `${this.currentActivity?.details ?? "empty"} -> ${next.details}`);
		this.currentActivity = next;
		this.request("SET_ACTIVITY", { pid: PROCESS_PID, activity: next }).catch((error) => log.error("error setting activity", error));
	}

	public clearActivity() {
		this.currentActivity = undefined;
		if (!this.isConnected) return;
		this.request("SET_ACTIVITY", { pid: PROCESS_PID }).catch((error) => log.error("error clearing activity", error));
	}

	public destroy() {
		this.destroyed = true;
		this.connected = false;
		this.currentActivity = undefined;
		this.settleReady?.(false);
		this.rejectRequests();
		this.removeAllListeners();
		this.ipc.removeAllListeners();
		this.ipc.destroy();
	}
}
