import { App } from "electron";
import { EventCollection } from "./eventCollection";
import { ProviderCollection } from "./providerCollection";

export async function createPluginCollection(app: App) {
	const collection = new ProviderCollection(app);
	await collection.initialize();
	return collection;
}

export async function createEventCollection(app: App, providers?: any[]) {
	const collection = new EventCollection(app);
	await collection.initialize(providers);
	return collection;
}
