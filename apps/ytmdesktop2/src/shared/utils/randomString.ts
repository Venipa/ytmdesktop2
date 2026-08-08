import { randomBytes } from "node:crypto";

/**
 * Generates a random string of a given size (base64 alphabet).
 */
export function generateRandom(size: number): string {
	const byteLength = Math.ceil(((size + 1) * 6) / 8);
	return randomBytes(byteLength).toString("base64").slice(0, size);
}
