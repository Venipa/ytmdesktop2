import { ipcPromise } from "@shared/utils/ipcPromise";

export async function waitMs(ms?: number) {
	return await new Promise<void>((resolve) => setTimeout(resolve, ms));
}
export type IpcPromiseResult<T> = ReturnType<typeof ipcPromise<T>>;
