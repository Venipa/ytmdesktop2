import type { BrowserWindowViews } from "@main/windows/mappedWindow";
import type { App } from "electron";

export type LifecyclePhase = "beforeInit" | "init" | "afterInit" | "destroy";

export type LifecycleContext = {
	app: App;
	windows: BrowserWindowViews<any> | null;
	getProvider: (name: string) => unknown;
};

type LifecycleHandler = (ctx: LifecycleContext) => void | Promise<void>;

const handlers: Record<LifecyclePhase, LifecycleHandler[]> = {
	beforeInit: [],
	init: [],
	afterInit: [],
	destroy: [],
};

let context: LifecycleContext | null = null;

export function setLifecycleContext(partial: Partial<LifecycleContext> & Pick<LifecycleContext, "app">): void {
	context = {
		app: partial.app,
		windows: partial.windows ?? context?.windows ?? null,
		getProvider: partial.getProvider ?? context?.getProvider ?? (() => undefined),
	};
}

export function getLifecycleContext(): LifecycleContext {
	if (!context) throw new Error("Lifecycle context not set");
	return context;
}

function register(phase: LifecyclePhase, handler: LifecycleHandler): void {
	handlers[phase].push(handler);
}

/** Maps to former BeforeStart */
export function onBeforeInit(handler: LifecycleHandler): void {
	register("beforeInit", handler);
}

/** Maps to former OnInit */
export function onInit(handler: LifecycleHandler): void {
	register("init", handler);
}

/** Maps to former AfterInit */
export function onAfterInit(handler: LifecycleHandler): void {
	register("afterInit", handler);
}

/** Maps to former OnDestroy */
export function onDestroy(handler: LifecycleHandler): void {
	register("destroy", handler);
}

export async function runLifecycle(phase: LifecyclePhase): Promise<void> {
	const ctx = getLifecycleContext();
	for (const handler of handlers[phase]) {
		await handler(ctx);
	}
}
