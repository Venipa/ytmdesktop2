import { App } from "electron";
import { EventCollection } from "./eventCollection";
import { ServiceCollection } from "./providerCollection";

export async function createServiceCollection(app: App) {
	const collection = new ServiceCollection(app);
	await collection.initialize();
	return collection;
}

export async function createEventCollection(app: App, providers?: any[]) {
	const collection = new EventCollection(app);
	await collection.initialize(providers);
	return collection;
}
