import type { ServiceCollection } from "@main/core/providerCollection";
import type { AppTrpcContext } from "@shared/trpc/context";
import { BrowserWindow } from "electron";
import type { CreateContextOptions } from "electron-trpc/main";

let services: ServiceCollection | null = null;

export function setTrpcServices(collection: ServiceCollection): void {
	services = collection;
}

function requireServices(): ServiceCollection {
	if (!services) {
		throw new Error("tRPC services not initialized");
	}
	return services;
}

function buildContext(getBrowserWindow: AppTrpcContext["getBrowserWindow"], event: AppTrpcContext["event"] = { sender: null }): AppTrpcContext {
	const collection = requireServices();
	return {
		event,
		getBrowserWindow,
		getProvider: (name) => collection.getProvider(name),
		getProviderByKey: (name) => collection.getProvider(name),
	};
}

export async function createTrpcContext({ event }: CreateContextOptions): Promise<AppTrpcContext> {
	return buildContext(() => BrowserWindow.fromWebContents(event.sender), event as AppTrpcContext["event"]);
}

/** Context for main→main createCaller (no renderer IPC event). */
export function createMainTrpcContext(): AppTrpcContext {
	return buildContext(() => {
		const wins = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
		return wins[0] ?? null;
	});
}
