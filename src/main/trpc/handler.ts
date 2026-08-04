import type { ServiceCollection } from "@main/core/providerCollection";
import { appRouter } from "@main/trpc/router";
import type { BrowserWindow } from "electron";
import { createIPCHandler } from "electron-trpc/main";
import { createTrpcContext, setTrpcServices } from "./context";

type TrpcHandler = ReturnType<typeof createIPCHandler>;

let handler: TrpcHandler | null = null;

export function initElectronTrpc(collection: ServiceCollection): void {
	setTrpcServices(collection);
	handler = createIPCHandler({
		router: appRouter as unknown as Parameters<typeof createIPCHandler>[0]["router"],
		createContext: createTrpcContext,
	});
}

export function attachTrpcWindow(win: BrowserWindow): void {
	handler?.attachWindow(win);
}
