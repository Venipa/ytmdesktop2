import { describe, expect, test } from "vitest";
import { encodeFrame, OPCode, readFrames } from "./ipc";

describe("readFrames", () => {
	const a = encodeFrame({ cmd: "DISPATCH", evt: "READY" }, OPCode.FRAME);
	const b = encodeFrame({ nonce: "n1" }, OPCode.PING);

	test("reads several frames from one chunk", () => {
		const { frames, rest } = readFrames(Buffer.concat([a, b]));
		expect(frames).toEqual([
			{ op: OPCode.FRAME, json: { cmd: "DISPATCH", evt: "READY" } },
			{ op: OPCode.PING, json: { nonce: "n1" } },
		]);
		expect(rest.length).toBe(0);
	});

	test("keeps a split frame until the rest arrives", () => {
		const first = readFrames(a.subarray(0, 5));
		expect(first.frames).toEqual([]);
		const second = readFrames(Buffer.concat([first.rest, a.subarray(5)]));
		expect(second.frames).toHaveLength(1);
		expect(second.rest.length).toBe(0);
	});

	test("skips a malformed body and keeps reading", () => {
		const bad = Buffer.alloc(8 + 3);
		bad.writeInt32LE(OPCode.FRAME, 0);
		bad.writeInt32LE(3, 4);
		bad.write("{x}", 8);
		const { frames } = readFrames(Buffer.concat([bad, b]));
		expect(frames).toEqual([{ op: OPCode.PING, json: { nonce: "n1" } }]);
	});
});
