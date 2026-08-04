import { useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";

export type WindowState = {
	height: number;
	width: number;
	x: number;
	y: number;
	id: number;
	maximized: boolean;
	minimized: boolean;
	closable: boolean;
	maximizable: boolean;
	minimizable: boolean;
	movable: boolean;
	resizable: boolean;
	menuBarVisible: boolean;
	fullScreen: boolean;
	fullScreenable: boolean;
	platform: {
		isWindows: boolean;
		isMacOS: boolean;
		isLinux: boolean;
	};
	simpleFullscreen: boolean;
	autoHideMenuBar: boolean;
	title: string;
	navigation: { canGoBack: boolean; index: number };
};

export function useSetting<T = unknown>(key: string, defaultValue?: T): [T, (val: T) => void] {
	const [value, setValue] = useState<T>((defaultValue ?? null) as T);
	const utils = trpc.useUtils();
	const update = trpc.settings.update.useMutation();

	trpc.settings.get.useQuery(
		{ key, defaultValue: defaultValue ?? null },
		{
			onSuccess: (v) => setValue((v ?? defaultValue ?? null) as T),
		},
	);

	trpc.settings.onChange.useSubscription(undefined, {
		onData: (ev) => {
			if (ev.key !== key) return;
			setValue((ev.value ?? defaultValue ?? null) as T);
			utils.settings.get.setData({ key, defaultValue: defaultValue ?? null }, ev.value);
		},
	});

	const set = useCallback(
		(next: T) => {
			setValue(next);
			update.mutate({ key, value: next });
		},
		[key, update],
	);

	return [value, set];
}

export function useWindowState() {
	const [state, setState] = useState<WindowState>({} as WindowState);
	trpc.window.state.useQuery(undefined, {
		onSuccess: (next) => {
			if (next) setState(next as WindowState);
		},
	});
	trpc.window.onState.useSubscription(undefined, {
		onData: (next) => {
			if (next) setState(next as WindowState);
		},
	});
	return [state, setState] as const;
}

export function useMainWindowState() {
	const [state, setState] = useState<WindowState>({} as WindowState);
	trpc.window.mainState.useQuery(undefined, {
		onSuccess: (next) => {
			if (next) setState(next as WindowState);
		},
	});
	trpc.window.onMainState.useSubscription(undefined, {
		onData: (next) => {
			if (next) setState(next as WindowState);
		},
	});
	return [state, setState] as const;
}
