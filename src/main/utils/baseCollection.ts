import { App } from "electron";
import { BaseProvider } from "./baseProvider";

export interface CollectionItem {
	getName?(): string;
	eventName?: string;
	__registerProviders?(providers: BaseProvider[]): void;
	__registerApp?(app: App): void;
}

export abstract class BaseCollection<T extends CollectionItem> {
	protected items: T[] = [];

	constructor(protected readonly app: App) {}

	protected async initializeItems(globPattern: string) {
		const collectionEntries = import.meta.glob(globPattern, { eager: true });
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
		return await Promise.all(this.items.filter((x) => typeof (x as any)[methodName] === "function").map((x) => Promise.resolve((x as any)[methodName](...args))));
	}

	getItems(): T[] {
		return this.items;
	}
}
