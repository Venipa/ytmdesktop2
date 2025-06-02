import logger from "@shared/utils/Logger";
import { App } from "electron";
import { BaseProviderNames } from "ytmd";
import { BaseCollection } from "./baseCollection";
import { BaseProvider } from "./baseProvider";

export class ProviderCollection extends BaseCollection<BaseProvider> {
	constructor(app: App) {
		super(app);
	}

	async initialize() {
		await this.initializeItems("../plugins/*.plugin.ts");
		this.items.forEach((p) => p.__registerProviders(this.items));
		return this;
	}

	async exec(event: "OnInit" | "OnDestroy" | "AfterInit" | "BeforeStart") {
		logger.debug(`executing provider event: "${event}" for ${this.getProviderNames().join(", ")}`);
		return await this.executeMethod(event, this.app);
	}

	getTypedProvider<T extends BaseProviderNames[K], K extends keyof BaseProviderNames & string>(name: K): T {
		return this.getProvider(name) as T;
	}
}
