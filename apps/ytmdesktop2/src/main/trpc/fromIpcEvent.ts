import { observable } from "@trpc/server/observable";
import { ipcMain } from "electron";

type MapArgs<T> = (args: unknown[]) => T;

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
				emit.next(mapArgs(args));
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
