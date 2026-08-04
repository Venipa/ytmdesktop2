import type pd from "../../preload/base";

declare const __dirname: string;
interface PreloadContext {
	api: typeof pd.api;
	ipcRenderer: typeof pd.ipcRenderer;
	app: typeof pd.app;
}
declare global {
	declare const __dirname: string;
	interface Window extends globalThis, PreloadContext {
		[key: string]: any;
	}
	declare module "*.svg" {
		import type { FC, SVGProps } from "react";
		const content: FC<SVGProps<SVGSVGElement>>;
		export default content;
	}
	declare module "*.svg?react" {
		import type { FC, SVGProps } from "react";
		const content: FC<SVGProps<SVGSVGElement>>;
		export default content;
	}
}

export {};
