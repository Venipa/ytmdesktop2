import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import slugify, { SlugifyOptions } from "@shared/slug";
import { base64 } from "@shared/utils/base64";
import { generateRandom } from "@shared/utils/randomString";
import { app } from "electron";
import { ConfOptions as Options, Conf as Store } from "electron-conf/main";
import Encryption from "encryption.js";
import { parse as deserialize, stringify as serialize } from "yaml";
const slugifyOptions = {
	lower: true,
	replacement: "_",
	trim: true,
	remove: /[*+~.()'"!:@]/g,
} as SlugifyOptions;
const getStoreUserData = () => app.getPath("userData");
if (!statSync(getStoreUserData(), { throwIfNoEntry: false })) mkdirSync(getStoreUserData(), { recursive: true });
export const createYmlStore = <T extends Record<string, any> = Record<string, any>>(name: string, options: Options<T> = {} as Options<T>) =>
	new Store<T>({
		ext: ".yml",
		...options,
		serializer: {
			read(raw) {
				return deserialize(raw);
			},
			write(value) {
				return serialize(value);
			},
		},
		name,
	});

export const createEncryptedStore = <T extends Record<string, any> = Record<string, any>>(name: string, options: Options<T> = {} as Options<T>) => {
	const encryptionKeyPath = path.join(getStoreUserData(), slugify(name, slugifyOptions) + ".key");
	const enc = new Encryption({ secret: base64.encode(name) });
	if (!existsSync(encryptionKeyPath)) writeFileSync(encryptionKeyPath, enc.encrypt({ name, secret: generateRandom(32) }));
	const encryptionKey = readFileSync(encryptionKeyPath).toString("utf8");
	const payload = enc.decrypt<{ name: string; secret: string }>(encryptionKey);
	if (!payload || name !== payload?.name) throw new Error("Invalid encryption key");
	if (!payload.secret) throw new Error("Invalid encryption secret");
	const storeEncryptor = new Encryption({ secret: payload.secret });
	return new Store<T>({
		ext: ".ytm",
		...options,
		serializer: {
			read(raw) {
				return storeEncryptor.decrypt(raw);
			},
			write(value) {
				return storeEncryptor.encrypt(value);
			},
		},
		name,
	});
};
