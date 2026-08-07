import EventEmitter from "node:events";
import { existsSync, statSync } from "node:fs";
import { type DiscordActivity } from "@main/lib/discord-rpc/discord-rpc";
import { createLogger } from "@shared/utils/console";
import { randomUUID } from "crypto";
import IPCClient, { OPCode } from "./ipc";

const log = createLogger("Lib:DiscordRPC.Client");

function directoryExists(dirPath: string): boolean {
	try {
		return existsSync(dirPath) && statSync(dirPath).isDirectory();
	} catch {
		return false;
	}
}

function getIPCPath(id: number): string {
	if (process.platform === "win32") {
		return `\\\\?\\pipe\\discord-ipc-${id}`;
	}

	const dirtyPrefix = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || "/tmp";
	// Snaps remap XDG_RUNTIME_DIR to .../snap.<name>; Discord IPC lives on the host runtime dir
	// (.../discord-ipc-N) or under packaged Discord dirs (snap / Flatpak stable|PTB|Canary).
	const prefix = dirtyPrefix.replace(/\/$/, "").replace(/\/snap\.[^/]+$/, "");
	const packagedDirs = [
		`${prefix}/snap.discord`,
		`${prefix}/snap.discord-ptb`,
		`${prefix}/snap.discord-canary`,
		`${prefix}/app/com.discordapp.Discord`,
		`${prefix}/app/com.discordapp.DiscordPTB`,
		`${prefix}/app/com.discordapp.DiscordCanary`,
	];
	for (const dir of packagedDirs) {
		const socketPath = `${dir}/discord-ipc-${id}`;
		if (existsSync(socketPath)) {
			return socketPath;
		}
	}
	for (const dir of packagedDirs) {
		if (directoryExists(dir)) {
			return `${dir}/discord-ipc-${id}`;
		}
	}
	return `${prefix}/discord-ipc-${id}`;
}

const PROCESS_PID = process?.pid ?? 0;
const MAX_CONNECTION_ITERATIONS = 10;

function stringLimit(str: string, limit: number, minimum: number) {
	if (str.length > limit) {
		return str.substring(0, limit - 3) + "...";
	}
	if (str.length < minimum) {
		return str.padEnd(minimum, "​"); // zero-width space
	}
	return str;
}

function activityDetailString(activity: DiscordActivity) {
	if (activity.details) activity.details = stringLimit(activity.details, 128, 2);
	if (activity.state) activity.state = stringLimit(activity.state, 128, 2);
	if (activity.assets) {
		if (activity.assets.large_text) activity.assets.large_text = stringLimit(activity.assets.large_text, 128, 2);
		if (activity.assets.small_text) activity.assets.small_text = stringLimit(activity.assets.small_text, 128, 2);
	}
	return activity;
}

export default class DiscordClient extends EventEmitter {
	private clientId: string | null = null;
	private connectionPromise: Promise<void> | null = null;
	private ipcClient = new IPCClient();
	private connected = false;
	private destroyed = false;
	private abortConnect = false;
	private currentActivity: DiscordActivity | undefined;
	private previousActivity: string | null = null;

	get presence() {
		return this.currentActivity;
	}

	get isConnected() {
		return this.connected && !this.destroyed;
	}

	constructor(clientId: string) {
		super();
		this.clientId = clientId;
	}

	public connect() {
		if (this.destroyed) return Promise.reject(new Error("DiscordClient destroyed"));
		if (this.connected) return Promise.resolve();
		if (this.connectionPromise) return this.connectionPromise;

		this.abortConnect = false;
		this.ipcClient.removeAllListeners();

		// Promise chaining is OK here — loop IPC paths until one works
		// eslint-disable-next-line no-async-promise-executor
		this.connectionPromise = new Promise(async (resolve, reject) => {
			log.debug(`initiated connection loop over ${MAX_CONNECTION_ITERATIONS} ids`);
			let id = 0;
			while (id < MAX_CONNECTION_ITERATIONS) {
				if (this.abortConnect || this.destroyed) {
					this.connectionPromise = null;
					reject(new Error("DiscordClient connect aborted"));
					return;
				}
				try {
					await new Promise<void>((ipcResolve, ipcReject) => {
						const ipcPath = getIPCPath(id);
						log.debug("connecting to discord at", ipcPath);
						this.ipcClient.once("close", () => {
							this.ipcClient.removeAllListeners();
							log.debug("failed to connect to discord at", ipcPath);
							ipcReject();
						});
						this.ipcClient.once("error", (error) => {
							log.error("socket error connecting to discord", error);
						});
						this.ipcClient.once("connect", () => {
							log.debug("connected to discord at", ipcPath);
							this.ipcClient.removeAllListeners();
							ipcResolve();
						});
						this.ipcClient.connect(ipcPath);
					});

					if (this.abortConnect || this.destroyed) {
						this.ipcClient.destroy();
						this.connectionPromise = null;
						reject(new Error("DiscordClient connect aborted"));
						return;
					}

					this.connected = true;
					this.ipcClient.send(
						{
							v: 1,
							client_id: this.clientId,
						},
						OPCode.HANDSHAKE,
					);
					this.emit("connect");

					this.ipcClient.on("close", () => {
						this.connected = false;
						this.emit("close");
					});
					this.ipcClient.on("error", (error) => {
						this.emit("error", error);
					});
					this.ipcClient.on("data", (payload: { op: OPCode; json: unknown }) => {
						if (payload?.op === OPCode.PING) {
							this.ipcClient.send(payload.json, OPCode.PONG);
						}
					});

					this.connectionPromise = null;
					resolve();
					return;
				} catch {
					id++;
				}
			}

			this.connectionPromise = null;
			reject(new Error("Failed to connect to Discord IPC"));
		});

		return this.connectionPromise;
	}

	public close() {
		this.abortConnect = true;
		this.connectionPromise = null;
		if (this.connected) {
			this.ipcClient.once("close", () => {
				this.ipcClient.removeAllListeners();
			});
			this.ipcClient.close();
		}
		this.connected = false;
	}

	public destroy() {
		this.abortConnect = true;
		this.destroyed = true;
		this.connected = false;
		this.currentActivity = undefined;
		this.previousActivity = null;
		this.connectionPromise = null;
		this.removeAllListeners();
		this.ipcClient.destroy();
	}

	public setActivity(activity: DiscordActivity) {
		if (!this.isConnected) return;
		this.currentActivity = activityDetailString(activity);
		try {
			this.ipcClient.send({
				cmd: "SET_ACTIVITY",
				args: {
					pid: PROCESS_PID,
					activity,
				},
				nonce: randomUUID(),
			});
			if (this.previousActivity !== activity.details) {
				log.debug("activity set", `${this.previousActivity ?? "empty"} -> ${activity.details}`);
				this.previousActivity = activity.details ?? null;
			}
		} catch (error) {
			log.error("error setting activity", error);
		}
	}

	public clearActivity() {
		this.currentActivity = undefined;
		if (!this.isConnected) return;
		try {
			this.ipcClient.send({
				cmd: "SET_ACTIVITY",
				args: {
					pid: PROCESS_PID,
				},
				nonce: randomUUID(),
			});
		} catch (error) {
			log.error("error clearing activity", error);
		}
	}
}
