import { existsSync, statSync } from "node:fs";
import { type DiscordActivity } from "@main/lib/discord-rpc/discord-rpc";
import { createLogger } from "@shared/utils/console";
import { randomUUID } from "crypto";
import EventEmitter from "events";
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
	const prefix = dirtyPrefix.replace(/\/$/, "");
	const discordSnapDir = "snap.discord";

	if (directoryExists(`${prefix}/${discordSnapDir}`)) {
		return `${prefix}/${discordSnapDir}/discord-ipc-${id}`;
	} else {
		return `${prefix}/discord-ipc-${id}`;
	}
}

const PROCESS_PID = import.meta.env.PROD ? (process?.pid ?? 0) : 0;
log.debug("PROCESS_PID", PROCESS_PID);
const MAX_CONNECTION_ITERATIONS = 10;

function stringLimit(str: string, limit: number, minimum: number) {
	if (str.length > limit) {
		return str.substring(0, limit - 3) + "...";
	}

	if (str.length < minimum) {
		return str.padEnd(minimum, "​"); // There's a zero width space here
	}

	return str;
}

function activityDetailString(activity: DiscordActivity) {
	activity.details = stringLimit(activity.details ?? "", 128, 2);
	activity.state = stringLimit(activity.state ?? "", 128, 2);
	if (activity.assets) {
		activity.assets.large_text = stringLimit(activity.assets.large_text ?? "", 128, 2);
		activity.assets.small_text = stringLimit(activity.assets.small_text ?? "", 128, 2);
	}
	return activity;
}

export default class DiscordClient extends EventEmitter {
	private clientId: string | null = null;
	private connectionPromise: Promise<void> | null = null;
	private ipcClient = new IPCClient();
	private connected = false;
	private currentActivity: DiscordActivity;
	get presence() {
		return this.currentActivity;
	}
	get isConnected() {
		return this.connected;
	}
	constructor(clientId: string) {
		super();

		this.clientId = clientId;
	}

	public connect() {
		if (this.connectionPromise) return this.connectionPromise;
		this.ipcClient.removeAllListeners();

		// Promise chaining is OK here, we're looping through different IPC paths and seeing which one works
		// eslint-disable-next-line no-async-promise-executor
		this.connectionPromise = new Promise(async (resolve, reject) => {
			log.debug(`initiated connection loop over ${MAX_CONNECTION_ITERATIONS} ids`);
			let id = 0;
			while (id < MAX_CONNECTION_ITERATIONS) {
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
						this.ipcClient.connect(getIPCPath(id));
					});

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
					this.ipcClient.on("data", (op: OPCode, json: unknown) => {
						switch (op) {
							case OPCode.PING: {
								this.ipcClient.send(json, OPCode.PONG);
								break;
							}

							default: {
								break;
							}
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
			reject();
		});

		return this.connectionPromise;
	}

	public close() {
		if (this.connected) {
			this.ipcClient.once("close", () => {
				this.ipcClient.removeAllListeners();
			});
			this.ipcClient.close();
		}
	}

	public destroy() {
		this.connected = false;
		this.currentActivity = undefined;
		this.removeAllListeners();
		this.ipcClient.destroy();
	}
	private previousActivity: string | null = null;
	public setActivity(activity: DiscordActivity) {
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
				this.previousActivity = activity.details;
			}
		} catch (error) {
			log.error("error setting activity", error);
		}
	}

	public clearActivity() {
		this.currentActivity = undefined;
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
