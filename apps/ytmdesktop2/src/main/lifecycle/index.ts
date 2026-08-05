import { defaultUri } from "@main/infra/devUtils";
import type { BrowserWindowViews } from "@main/windows/mappedWindow";
import type { App, WebContentsView } from "electron";

export type LifecyclePhase = "beforeInit" | "init" | "afterInit" | "musicReload" | "destroy";

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
	musicReload: [],
	destroy: [],
};

let context: LifecycleContext | null = null;
let attachedMusicWebContentsId: number | null = null;

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

/**
 * Runs when the youtube view finishes loading music.youtube.com
 * (initial load, reload, post-login refresh). Prefer this over
 * attaching did-finish-load on youtubeView yourself.
 */
export function onMusicReload(handler: LifecycleHandler): void {
	register("musicReload", handler);
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

function isMusicYoutubeUrl(url: string): boolean {
	try {
		return new URL(url).hostname === defaultUri.hostname;
	} catch {
		return false;
	}
}

function getYoutubeView(windows: BrowserWindowViews<any> | null): WebContentsView | null {
	const view = windows?.views?.youtubeView as WebContentsView | undefined;
	if (!view?.webContents || view.webContents.isDestroyed()) return null;
	return view;
}

function attachMusicReloadBridge(windows: BrowserWindowViews<any> | null): void {
	const view = getYoutubeView(windows);
	if (!view) return;

	const webContentsId = view.webContents.id;
	if (attachedMusicWebContentsId === webContentsId) return;
	attachedMusicWebContentsId = webContentsId;

	const maybeRun = () => {
		if (view.webContents.isDestroyed()) return;
		if (!isMusicYoutubeUrl(view.webContents.getURL())) return;
		void runLifecycle("musicReload");
	};

	view.webContents.on("did-finish-load", maybeRun);
	if (!view.webContents.isLoading()) maybeRun();
}

// Single did-finish-load → music.youtube.com bridge for all onMusicReload handlers
onAfterInit(({ windows }) => {
	attachMusicReloadBridge(windows);
});
