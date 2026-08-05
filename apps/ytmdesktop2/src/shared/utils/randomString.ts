import { Buffer } from "buffer";
import { enc, lib } from "crypto-js";
/**
 * Generates a random string of a given size
 */
export function generateRandom(size: number): string {
	const bits = (size + 1) * 6;
	const buffer = Buffer.from(lib.WordArray.random(Math.ceil(bits / 8)).toString(enc.Hex), "hex");
	return buffer.toString("base64", 0, size);
}
