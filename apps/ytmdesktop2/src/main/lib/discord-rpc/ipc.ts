import EventEmitter from "node:events";
import { Socket } from "node:net";

export enum OPCode {
	HANDSHAKE = 0,
	FRAME = 1,
	CLOSE = 2,
	PING = 3,
	PONG = 4,
}

export interface IPCFrame {
	op: OPCode;
	json: any;
}

const HEADER_SIZE = 8;

export function encodeFrame(data: unknown, op: OPCode): Buffer {
	const json = JSON.stringify(data);
	const length = Buffer.byteLength(json);
	const buffer = Buffer.alloc(HEADER_SIZE + length);
	buffer.writeInt32LE(op, 0);
	buffer.writeInt32LE(length, 4);
	buffer.write(json, HEADER_SIZE, length);
	return buffer;
}

/** Frames are `[op:i32le][len:i32le][json]` and may span or share socket chunks; `rest` is the incomplete tail. */
export function readFrames(buffer: Buffer): { frames: IPCFrame[]; rest: Buffer } {
	const frames: IPCFrame[] = [];
	let offset = 0;
	while (buffer.length - offset >= HEADER_SIZE) {
		const length = buffer.readInt32LE(offset + 4);
		const end = offset + HEADER_SIZE + length;
		if (end > buffer.length) break;
		const op = buffer.readInt32LE(offset);
		const body = buffer.toString("utf-8", offset + HEADER_SIZE, end);
		offset = end;
		try {
			frames.push({ op, json: JSON.parse(body) });
		} catch {
			/* malformed frame body, skip it */
		}
	}
	return { frames, rest: buffer.subarray(offset) };
}

/**
 * One Discord IPC pipe. Emits `frame`, plus `close` / `error` only after the pipe opened;
 * `destroy()` is silent so the owner decides what a teardown means.
 */
export default class IPCClient extends EventEmitter {
	private socket: Socket | null = null;
	private pending: Buffer = Buffer.alloc(0);
	private settleConnect: ((opened: boolean) => void) | null = null;

	/** Resolves true once the pipe is open, false if it fails or `destroy()` runs first. */
	public connect(ipcPath: string): Promise<boolean> {
		this.destroy();
		const socket = new Socket();
		this.socket = socket;
		this.pending = Buffer.alloc(0);
		let opened = false;

		return new Promise<boolean>((resolve) => {
			this.settleConnect = resolve;
			socket.on("connect", () => {
				opened = true;
				this.settleConnect = null;
				resolve(true);
			});
			socket.on("error", (error) => {
				if (opened) this.emit("error", error);
			});
			socket.on("close", () => {
				if (!opened) return void this.destroy();
				this.socket = null;
				this.emit("close");
			});
			socket.on("data", (chunk: Buffer) => {
				const { frames, rest } = readFrames(Buffer.concat([this.pending, chunk]));
				this.pending = rest;
				for (const frame of frames) this.emit("frame", frame);
			});
			socket.connect(ipcPath);
		});
	}

	public send(data: unknown, op = OPCode.FRAME): boolean {
		if (!this.socket?.writable) return false;
		this.socket.write(encodeFrame(data, op));
		return true;
	}

	public destroy() {
		this.settleConnect?.(false);
		this.settleConnect = null;
		if (!this.socket) return;
		this.socket.removeAllListeners();
		this.socket.on("error", () => {}); // late errors from a torn-down socket must not crash main
		this.socket.destroy();
		this.socket = null;
	}
}
