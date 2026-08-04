export type AppTrpcContext = {
	event: { sender: unknown };
	getBrowserWindow: () => {
		isMinimizable?: () => boolean;
		isMaximizable?: () => boolean;
		isMaximized?: () => boolean;
		minimize?: () => void;
		maximize?: () => void;
		unmaximize?: () => void;
		isDestroyed?: () => boolean;
		isAlwaysOnTop?: () => boolean;
		setAlwaysOnTop?: (value: boolean) => void;
	} | null;
	getProvider: (name: string) => unknown;
	getProviderByKey: (name: string) => unknown;
};

/** Cast helper for service methods on loose context */
export function provider<T = any>(ctx: AppTrpcContext, name: string): T {
	return ctx.getProvider(name) as T;
}

export function providerByKey<T = any>(ctx: AppTrpcContext, name: string): T {
	return ctx.getProviderByKey(name) as T;
}
