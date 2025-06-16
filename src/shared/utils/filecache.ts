import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { base64 } from "@shared/utils/base64";
import { app } from "electron";
import Encryption from "encryption.js";

const cachePath = join(app.getPath("userData"), "cache");
if (!existsSync(cachePath)) mkdirSync(cachePath);
export async function cacheWithFile<T>(fn: () => Promise<T>, key: string): Promise<T> {
	const enc = new Encryption({ secret: base64.encode(key) });
	const cacheFile = join(cachePath, key + ".ytm");
	if (existsSync(cacheFile)) {
		return enc.decrypt(readFileSync(cacheFile, "utf8"));
	}
	const result = (await fn()) as T;
	writeFileSync(cacheFile, enc.encrypt(result));
	return result;
}
