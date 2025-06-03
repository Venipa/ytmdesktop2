import logger from "@shared/utils/Logger";
import { App } from "electron";
import { BaseProvider } from "./baseProvider";

export interface CollectionItem {
	getName?(): string;
	eventName?: string;
	__registerProviders?(providers: BaseProvider[]): void;
	__registerApp?(app: App): void;
	__registerWindows?(context: any): void;
}

export type LifecycleEvent = "OnInit" | "OnDestroy" | "AfterInit" | "BeforeStart";

const GLOB_PATTERNS = {
	plugins: () => import.meta.glob("../plugins/*.plugin.ts", { eager: true }),
	providers: () => import.meta.glob("../providers/*.provider.ts", { eager: true }),
	events: () => import.meta.glob("../events/*.event.ts", { eager: true }),
} as const;
export abstract class BaseCollection<T extends CollectionItem> {
	protected items: T[] = [];
	protected logger = logger.child(this.constructor.name);

	constructor(protected readonly app: App) {}

	protected async initializeItems(globPattern: keyof typeof GLOB_PATTERNS) {
		const patternImport = GLOB_PATTERNS[globPattern];
		if (!patternImport) {
			throw new Error(`Invalid glob pattern: ${globPattern}`);
		}
		const collectionEntries = patternImport();
		this.items = Object.values(collectionEntries)
			.map((m: any) => m.default)
			.filter(Boolean)
			.map((item: any) => new item(this.app));
	}

	getProviderNames(): string[] {
		return this.items.map((x) => x.getName?.() ?? x.eventName ?? "");
	}

	getProvider<K extends string>(name: K): T | undefined {
		return this.items.find((x) => x.getName?.() === name || x.eventName === name);
	}

	protected async executeMethod(methodName: string, ...args: any[]): Promise<any[]> {
		const itemsWithMethod = this.items.filter((x) => typeof (x as any)[methodName] === "function");
		if (itemsWithMethod.length === 0) return [];

		this.logger.debug(`Executing ${methodName} on ${itemsWithMethod.map((x) => x.getName?.() ?? x.eventName).join(", ")}`);
		return await Promise.all(itemsWithMethod.map((x) => Promise.resolve((x as any)[methodName](...args))));
	}

	getItems(): T[] {
		return this.items;
	}

	async executeLifecycleEvent(event: LifecycleEvent, ...args: any[]): Promise<any[]> {
		return await this.executeMethod(event, ...args);
	}

	registerWindows(context: any) {
		this.items.forEach((item) => {
			if (typeof item.__registerWindows === "function") {
				item.__registerWindows(context);
			}
		});
	}

	registerProviders(providers: BaseProvider[]) {
		this.items.forEach((item) => {
			if (typeof item.__registerProviders === "function") {
				item.__registerProviders(providers);
			}
		});
	}

	registerApp() {
		this.items.forEach((item) => {
			if (typeof item.__registerApp === "function") {
				item.__registerApp(this.app);
			}
		});
	}
}
