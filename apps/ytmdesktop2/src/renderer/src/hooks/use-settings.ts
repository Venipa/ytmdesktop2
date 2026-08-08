import { debounce } from "lodash-es";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@main/trpc/router";
import { trpc } from "@/lib/trpc";

export type WindowState = NonNullable<inferRouterOutputs<AppRouter>["window"]["state"]>;
export type MainWindowState = NonNullable<inferRouterOutputs<AppRouter>["window"]["mainState"]>;

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

	const mapRef = useRef(map);
	mapRef.current = map;
	const filterRef = useRef(filter);
	filterRef.current = filter;
	const defaultRef = useRef(defaultValue);
	defaultRef.current = defaultValue;
	const onPersistedRef = useRef(onPersisted);
	onPersistedRef.current = onPersisted;

	const { mutateAsync: update, isLoading: isMutating } = trpc.settings.update.useMutation();
	const updateRef = useRef(update);
	updateRef.current = update;

	// Stable debounce — do not recreate when `update` identity changes (drops pending writes).
	const persist = useMemo(() => {
		const write = (next: T) => {
			void updateRef.current({ key, value: next }).then(() => {
				onPersistedRef.current?.(next);
			});
		};
		if (typeof debounceMs === "number" && debounceMs > 0) {
			return debounce(write, debounceMs, { maxWait: Math.max(debounceMs * 3, 250) });
		}
		return write;
	}, [key, debounceMs]);

	useEffect(() => {
		return () => {
			if (typeof persist === "function" && "cancel" in persist && typeof persist.cancel === "function") {
				persist.cancel();
			}
		};
	}, [persist]);

	const { data, isLoading: isQueryLoading, isSuccess } = trpc.settings.get.useQuery(queryInput);
	const value = resolveSettingValue(isSuccess ? data : undefined, defaultValue, map);

	trpc.settings.onChange.useSubscription(undefined, {
		onData: (ev) => {
			if (ev.key !== key) return;
			if (filterRef.current && !filterRef.current(ev.value, ev.prevValue)) return;
			utils.settings.get.setData(queryInput, ev.value);
		},
	});

	const setValue = useCallback<SettingsSetter<T>>(
		(next) => {
			const prev = resolveSettingValue(utils.settings.get.getData(queryInput), defaultRef.current, mapRef.current);
			const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
			if (Object.is(prev, resolved)) return;
			utils.settings.get.setData(queryInput, resolved);
			persist(resolved);
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
	const utils = trpc.useUtils();
	const { data } = trpc.window.state.useQuery();
	trpc.window.onState.useSubscription(undefined, {
		onData: (next) => {
			if (next) utils.window.state.setData(undefined, next as WindowState);
		},
	});
	const state = data ?? ({} as WindowState);
	return [state] as const;
}

export function useMainWindowState() {
	const utils = trpc.useUtils();
	const { data } = trpc.window.mainState.useQuery();
	trpc.window.onMainState.useSubscription(undefined, {
		onData: (next) => {
			if (next) utils.window.mainState.setData(undefined, next as MainWindowState);
		},
	});
	const state = data ?? ({} as MainWindowState);
	return [state] as const;
}
