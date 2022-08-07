import eventNames from '@/app/utils/eventNames';
import { IpcRendererEvent } from 'electron';
import { onMounted, onUnmounted, Ref, ref } from 'vue';

type Map<T, R> =
  | ((item: T, name: string) => T)
  | ((item: T, name: string) => R);
type IpcHandler = (ev: IpcRendererEvent, ...args: any[]) => void;
type RefReturn<R> = [Ref<R>, (val: R) => void];
type RefIpcOptions<T, R> = {
  defaultValue?: R;
  mapper?: Map<T, R>;
  ignoreUndefined?: boolean;
  rawArgs?: boolean;
};
export function refIpc<T, R = T>(
  eventName: keyof typeof eventNames,
  options?: Partial<RefIpcOptions<T, R>>
): RefReturn<R>;
export function refIpc<T, R = T>(
  eventName: string,
  options?: Partial<RefIpcOptions<T, R>>
): RefReturn<R>;
export function refIpc<T, R = T>(
  eventName: string[],
  options?: Partial<RefIpcOptions<T, R>>
): RefReturn<R>;
export function refIpc<T, R = T>(
  eventName: string | string[],
  options?: Partial<RefIpcOptions<T, R>>
): RefReturn<R> {
  const { defaultValue, mapper, ignoreUndefined, rawArgs } = options ?? {};
  const defaultMapper = (item: T) => item;
  const objMap = (mapper || defaultMapper) as (item: T, name: string) => R;
  const state = ref<R>(defaultValue as R) as Ref<R>;
  const handlerNames = [eventName].flat().map((x) => eventNames[x] ?? x);
  const handlers: { [key: string]: IpcHandler } = handlerNames.reduce(
    (acc, handlerName) => {
      acc[handlerName] = ((ev, ...data) => {
        const vArgs = rawArgs !== true ? data.flat()?.[0] : data;
        const newVal = objMap((vArgs as any) as T, handlerName);
        if (ignoreUndefined && typeof newVal === "undefined") return;
        state.value = newVal;
        // console.log(`[IPC:Receiving@${handlerName}] `, ev, ...data);
      }) as IpcHandler;
      return acc;
    },
    {}
  );
  onMounted(() => {
    handlerNames.forEach((handlerName) =>
      (window as any).api.on(handlerName, handlers[handlerName])
    );
  });
  onUnmounted(() => {
    handlerNames.forEach((handlerName) =>
      (window as any).api.off(handlerName, handlers[handlerName])
    );
  });
  return [state, (val: R) => (state.value = val)];
}
