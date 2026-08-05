import path from "node:path";
import slugify, { type SlugifyOptions } from "@shared/slug";
import { base64 } from "@shared/utils/base64";
import { logger } from "@shared/utils/console";
import { generateRandom } from "@shared/utils/randomString";
import { app } from "electron";
import { type ConfOptions as Options, Conf as Store } from "electron-conf/main";
import Encryption from "encryption.js";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { parse as deserialize, stringify as serialize } from "yaml";

const slugifyOptions = {
	lower: true,
	replacement: "_",
	trim: true,
	remove: /[*+~.()'"!:@]/g,
} as SlugifyOptions;
const getStoreUserData = () => app.getPath("userData");
if (!statSync(getStoreUserData(), { throwIfNoEntry: false })) mkdirSync(getStoreUserData(), { recursive: true });
logger.debug("getStoreUserData", getStoreUserData());
/** Persistent secret for a named encryptor (key file next to userData). */
export function getOrCreateEncryptionSecret(name: string): string {
	const encryptionKeyPath = path.join(getStoreUserData(), slugify(name, slugifyOptions) + ".key");
  const storeMasterSecret = base64.encode(name.padStart(32, "0"));
	const enc = new Encryption({ secret: storeMasterSecret }); // secret requires 32 characters
	if (!existsSync(encryptionKeyPath)) writeFileSync(encryptionKeyPath, enc.encrypt({ name, secret: generateRandom(32) }));
	const encryptionKey = readFileSync(encryptionKeyPath).toString("utf8");
	const payload = enc.decrypt<{ name: string; secret: string }>(encryptionKey);
	if (!payload || name !== payload?.name) throw new Error("Invalid encryption key");
	if (!payload.secret) throw new Error("Invalid encryption secret");
	return payload.secret;
}

export function createEncryption(name: string, algorithm: "aes-256-gcm" | "aes-256-cbc" = "aes-256-cbc"): Encryption {
	return new Encryption({ secret: getOrCreateEncryptionSecret(name), algorithm });
}

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
	const storeEncryptor = createEncryption(name, "aes-256-cbc");
	return new Store<T>({
		ext: ".ytm",
		...options,
		serializer: {
			read(raw) {
				try {
          const decrypted = storeEncryptor.decrypt(raw);
				if (!decrypted || typeof decrypted !== "object") {
					logger.error(`Failed to decrypt store "${name}" — file unreadable, using empty store`);
					return {} as T;
				}
				return decrypted as T;
        } catch (ex) {
          logger.error(`Failed to decrypt store "${name}" — file unreadable, using empty store`, ex);
          const newStore = options.defaults ?? {} as T; // return empty store on encryption error
          return newStore;
        }
			},
			write(value) {
				return storeEncryptor.encrypt(value);
			},
		},
		name,
	});
};
