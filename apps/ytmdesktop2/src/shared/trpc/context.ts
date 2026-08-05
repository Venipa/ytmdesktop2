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
};
