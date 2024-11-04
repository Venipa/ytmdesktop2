import { default as Encryption } from "encryption.js";
export const createEncryption = (secret: string) => (Encryption as any)({ secret }) as Encryption;
export { };

