import { debounce } from "lodash-es";
import { useCallback, useMemo, useRef, useState } from "react";
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

export type UseSettingsStateOptions<T> = {
	debounce?: number;
	filter?: (value: unknown, prevValue: unknown) => boolean;
	map?: (value: unknown) => T;
	/** Fired after a value is successfully persisted (post-debounce). */
	onPersisted?: (value: T) => void;
};

type SettingsSetter<T> = (value: T | ((prev: T) => T)) => void;

export type UseSettingsStateMeta = {
	/** Initial settings fetch in flight */
	isPending: boolean;
	/** Persist mutation in flight */
	isSaving: boolean;
};

export type UseSettingsStateResult<T> = [T, SettingsSetter<T>, UseSettingsStateMeta];

function resolveSettingValue<T>(raw: unknown, defaultValue: T, map?: (value: unknown) => T): T {
	if (map) return map(raw);
	if (raw === undefined || raw === null) return defaultValue;
	return raw as T;
}

/**
 * Subscribe to a settings key. `setValue` updates UI immediately, then persists
 * (optionally debounced). Remote `onChange` events sync back in.
 */
export function useSettingsState<T>(key: string, defaultValue: T, options: UseSettingsStateOptions<T> = {}): UseSettingsStateResult<T> {
	const { debounce: debounceMs, filter, map, onPersisted } = options;
	const utils = trpc.useUtils();
	const queryInput = useMemo(() => ({ key, defaultValue: defaultValue ?? null }), [key, defaultValue]);
	const [value, setLocal] = useState<T>(() => resolveSettingValue(undefined, defaultValue, map));

	const mapRef = useRef(map);
	mapRef.current = map;
	const filterRef = useRef(filter);
	filterRef.current = filter;
	const defaultRef = useRef(defaultValue);
	defaultRef.current = defaultValue;
	const onPersistedRef = useRef(onPersisted);
	onPersistedRef.current = onPersisted;

	const { mutateAsync: update, isLoading: isMutating } = trpc.settings.update.useMutation();

	const persist = useMemo(() => {
		const write = (next: T) => {
			void update({ key, value: next }).then(() => {
				onPersistedRef.current?.(next);
			});
		};
		return typeof debounceMs === "number" && debounceMs > 0 ? debounce(write, debounceMs) : write;
	}, [key, update, debounceMs]);

	const { isLoading: isQueryLoading } = trpc.settings.get.useQuery(queryInput, {
		onSuccess: (raw) => {
			setLocal(resolveSettingValue(raw, defaultRef.current, mapRef.current));
		},
	});

	trpc.settings.onChange.useSubscription(undefined, {
		onData: (ev) => {
			if (ev.key !== key) return;
			if (filterRef.current && !filterRef.current(ev.value, ev.prevValue)) return;
			const next = resolveSettingValue(ev.value, defaultRef.current, mapRef.current);
			setLocal(next);
			utils.settings.get.setData(queryInput, ev.value);
		},
	});

	const setValue = useCallback<SettingsSetter<T>>(
		(next) => {
			setLocal((prev) => {
				const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
				utils.settings.get.setData(queryInput, resolved);
				persist(resolved);
				return resolved;
			});
		},
		[persist, queryInput, utils.settings.get],
	);

	return [value, setValue, { isPending: isQueryLoading, isSaving: isMutating }];
}

/** @deprecated Prefer `useSettingsState`. */
export function useSetting<T = unknown>(key: string, defaultValue?: T): UseSettingsStateResult<T> {
	return useSettingsState<T>(key, (defaultValue ?? null) as T);
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
