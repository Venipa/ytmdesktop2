import type pd from "../../preload/base";

declare const __dirname: string;
interface PreloadContext {
	api: typeof pd.api;
	ipcRenderer: typeof pd.ipcRenderer;
	process: typeof pd.process;
}
declare global {
	declare const __dirname: string;
	interface Window extends globalThis, PreloadContext {
		[key: string]: any;
	}
	declare module "*.svg" {
		import type { FunctionalComponent } from "vue";
		const content: FunctionalComponent;
		export default content;
	}
}

declare module "@vue/runtime-core" {
	interface ComponentCustomProperties {
		window: typeof window;
		console: typeof console;
		api: typeof window.api;
		translations: Record<string, string>;
	}
}

export {}; // Important!
