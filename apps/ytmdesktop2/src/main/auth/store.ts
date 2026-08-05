import type { AuthClientRecord } from "@main/auth/manager";
import { createEncryptedStore } from "@main/lib/store/createYmlStore";

interface AuthStoreShape {
	clients: AuthClientRecord[];
}

const authStore = createEncryptedStore<AuthStoreShape>("ytm-auth", {
	defaults: { clients: [] },
});

export function readAuthClients(): AuthClientRecord[] {
	const clients = authStore.get("clients", []);
	return Array.isArray(clients) ? clients : [];
}

export function writeAuthClients(clients: AuthClientRecord[]): void {
	authStore.set("clients", clients);
}

export { authStore };
