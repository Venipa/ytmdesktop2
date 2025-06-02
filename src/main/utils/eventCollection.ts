import { App } from "electron";
import { BaseCollection } from "./baseCollection";
import { BaseEvent } from "./baseEvent";
import { BaseProvider } from "./baseProvider";

export class EventCollection extends BaseCollection<BaseEvent> {
	constructor(app: App) {
		super(app);
	}

	async initialize(providers?: BaseProvider[]) {
		await this.initializeItems("../events/*.event.ts");
		this.items.forEach((p) => {
			if (providers) p.__registerProviders(providers);
			p.__registerApp(this.app);
		});
		return this;
	}

	async prepare() {
		return await this.executeMethod("__prepare");
	}
}
