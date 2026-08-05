import { Buffer } from "buffer";

/*
 * @poppinss/utils
 *
 * (c) Poppinss
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * Helper class to base64 encode/decode values with option
 * for url encoding and decoding
 */
class Base64 {
	/**
	 * Base64 encode Buffer or string
	 */
	encode(arrayBuffer: ArrayBuffer | SharedArrayBuffer): string;
	encode(data: string, encoding?: BufferEncoding): string;
	encode(data: ArrayBuffer | SharedArrayBuffer | string, encoding?: BufferEncoding): string {
		if (typeof data === "string") {
			return Buffer.from(data, encoding).toString("base64");
		}
		return Buffer.from(data).toString("base64");
	}

	/**
	 * Base64 decode a previously encoded string or Buffer.
	 */
	decode(encode: string, encoding: BufferEncoding, strict: true): string;
	decode(encode: string, encoding: undefined, strict: true): string;
	decode(encode: string, encoding?: BufferEncoding, strict?: false): string | null;
	decode(encode: Buffer, encoding?: BufferEncoding): string;
	decode(encoded: string | Buffer, encoding: BufferEncoding = "utf8", strict: boolean = false): string | null {
		if (Buffer.isBuffer(encoded)) {
			return encoded.toString(encoding);
		}

		const decoded = Buffer.from(encoded, "base64").toString(encoding);
		const isInvalid = this.encode(decoded, encoding) !== encoded;

		if (strict && isInvalid) {
			throw new Error("Cannot decode malformed value");
		}

		return isInvalid ? null : decoded;
	}

	/**
	 * Base64 encode Buffer or string to be URL safe. (RFC 4648)
	 */
	urlEncode(arrayBuffer: ArrayBuffer | SharedArrayBuffer): string;
	urlEncode(data: string, encoding?: BufferEncoding): string;
	urlEncode(data: ArrayBuffer | SharedArrayBuffer | string, encoding?: BufferEncoding): string {
		const encoded = typeof data === "string" ? this.encode(data, encoding) : this.encode(data);
		return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/\=/g, "");
	}

	/**
	 * Base64 URL decode a previously encoded string or Buffer. (RFC 4648)
	 */
	urlDecode(encode: string, encoding: BufferEncoding, strict: true): string;
	urlDecode(encode: string, encoding: undefined, strict: true): string;
	urlDecode(encode: string, encoding?: BufferEncoding, strict?: false): string | null;
	urlDecode(encode: Buffer, encoding?: BufferEncoding): string;
	urlDecode(encoded: string | Buffer, encoding: BufferEncoding = "utf8", strict: boolean = false): string | null {
		if (Buffer.isBuffer(encoded)) {
			return encoded.toString(encoding);
		}

		const decoded = Buffer.from(encoded, "base64").toString(encoding);
		const isInvalid = this.urlEncode(decoded, encoding) !== encoded;

		if (strict && isInvalid) {
			throw new Error("Cannot urlDecode malformed value");
		}

		return isInvalid ? null : decoded;
	}
}

export const base64 = new Base64();
