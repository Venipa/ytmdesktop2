import eventNames from "@main/utils/eventNames";
import { IpcRendererEvent } from "electron";
import { Ref, onBeforeMount, onMounted, onUnmounted, ref } from "vue";
import { createLogger } from "./console";
const logger = createLogger("refIpc");
type Map<T, R> = ((item: T, name: string, prev: any) => T) | ((item: T, name: string, prev: any) => R);
type Trigger<T> = (item: T, prev: T) => void;
type IpcHandler = (ev: IpcRendererEvent, ...args: any[]) => void;
type RefReturn<R> = [Ref<R>, (val: R) => void];
type RefIpcOptions<T, R> = {
	defaultValue?: R;
	mapper?: Map<T, R>;
	onTrigger?: Trigger<T>;
	onMounted?: () => void;
	getInitialValue?: () => Promise<R> | R;
	ignoreUndefined?: boolean;
	rawArgs?: boolean;
	debug?: boolean;
};
export function refIpc<T, R = T>(eventName: keyof typeof eventNames, options?: Partial<RefIpcOptions<T, R>>): RefReturn<R>;
export function refIpc<T, R = T>(eventName: string, options?: Partial<RefIpcOptions<T, R>>): RefReturn<R>;
export function refIpc<T, R = T>(eventName: string[], options?: Partial<RefIpcOptions<T, R>>): RefReturn<R>;
export function refIpc<T, R = T>(eventName: string | string[], options?: Partial<RefIpcOptions<T, R>>): RefReturn<R> {
	const { defaultValue, mapper, onTrigger, ignoreUndefined, rawArgs, getInitialValue } = options ?? {};
	const defaultMapper = (item: T) => item;
	const objMap = (mapper || defaultMapper) as (item: T, name: string, prev: any) => R;
	const state = ref<R>(defaultValue as R) as Ref<R>;
	const handlerNames = [eventName].flat().map((x) => eventNames[x] ?? x);
	const log = logger.child(handlerNames.join(","));
	const handlers: { [key: string]: IpcHandler } = handlerNames.reduce((acc, handlerName) => {
		acc[handlerName] = ((ev, ...data) => {
			const vArgs = rawArgs !== true ? data.flat()?.[0] : data;
			const newVal = objMap(vArgs as any as T, handlerName, state.value);
			if (ignoreUndefined && typeof newVal === "undefined") return;
			onTrigger?.(newVal as any, state.value as any);
			state.value = newVal;
			if (options?.debug) log.debug(`received`, ev, ...data);
		}) as IpcHandler;
		return acc;
	}, {});
	onMounted(async () => {
		log.debug(`mounted`, { getInitialValue, options });
		handlerNames.forEach((handlerName) => window.api.on(handlerName, handlers[handlerName]));
		options?.onMounted?.();

		if (getInitialValue) {
			const initialValue = await Promise.resolve(getInitialValue?.());
			log.debug(`initialValue`, { initialValue });
			state.value = initialValue;
		}
	});
	onUnmounted(() => {
		log.debug(`unmounted`);
		handlerNames.forEach((handlerName) => window.api.off(handlerName, handlers[handlerName]));
	});
	return [state, (val: R) => (state.value = val)];
}
export function refIpcSetting<T = any>(key: string, defaultValue?: T) {
	const refVal = refIpc("SERVER_SETTINGS_CHANGE", {
		mapper: ([skey, value]) => {
			if (skey === key) return value as T;
			return undefined;
		},
		rawArgs: true,
		ignoreUndefined: true,
	});
	onMounted(() => {
		window.api.settingsProvider.get(key, null).then((initialValue) => refVal[1](initialValue ?? defaultValue ?? null));
	});
	return refVal;
}
export function refWindowState<
	T extends {
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
	},
>() {
	const refVal = refIpc<T>("windowState", { defaultValue: {} as T });
	onBeforeMount(() => {
		window.api.windowState().then(refVal[1]);
	});
	return refVal;
}
export function refMainWindowState<
	T extends {
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
		autoHideMenuBar: boolean;
		title: string;
		platform: {
			isWindows: boolean;
			isMacOS: boolean;
			isLinux: boolean;
		};
		simpleFullscreen: boolean;
		navigation: { canGoBack: boolean; index: number };
	},
>() {
	const refVal = refIpc<T>("mainWindowState", { defaultValue: {} as T });
	onBeforeMount(() => {
		window.api.mainWindowState().then(refVal[1]);
	});
	return refVal;
}
