import { observable } from "@trpc/server/observable";
import { ipcMain } from "electron";

type MapArgs<T> = (args: unknown[]) => T;

function isIpcMainEvent(value: unknown): boolean {
	return !!value && typeof value === "object" && "sender" in (value as object) && "reply" in (value as object);
}

function payloadArgs(args: unknown[]): unknown[] {
	return isIpcMainEvent(args[0]) ? args.slice(1) : args;
}

/**
 * Temporary bridge: ServiceCollection providers still emit on serverMain/ipcMain.
 * Stateful router modules should subscribe via their own service EventEmitter instead.
 */
export function fromIpcEvent<T>(channel: string, map?: MapArgs<T>) {
	const mapArgs: MapArgs<T> =
		map ??
		((args) => {
			const payload = args.length <= 1 ? args[0] : args;
			return payload as T;
		});

	return observable<T>((emit) => {
		const handler = (...args: unknown[]) => {
			try {
				emit.next(mapArgs(payloadArgs(args)));
			} catch (err) {
				emit.error(err);
			}
		};
		ipcMain.on(channel, handler);
		return () => {
			ipcMain.removeListener(channel, handler);
		};
	});
}
