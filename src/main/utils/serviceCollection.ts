import logger from "@shared/utils/Logger";
import { App } from "electron";
import { BaseProviderNames } from "ytmd";

import { BaseEvent } from "./baseEvent";
import { BaseProvider } from "./baseProvider";

export async function createPluginCollection(app: App) {
  return (() => {
    const collectionEntries = import.meta.glob("../plugins/*.plugin.ts", { eager: true });
    const providers: (BaseProvider & any)[] = Object.values(collectionEntries)
      .map((m: any) => {
        return m.default;
      })
      .filter(Boolean)
      .map((provider: any) => new provider(app));
    providers.forEach((p: BaseProvider) => p.__registerProviders(providers));
    const getProviderNames = () => providers.map((x: BaseProvider) => x.getName());
    return {
      providers,
      getProviderNames,
      exec: async (event: "OnInit" | "OnDestroy" | "AfterInit" | "BeforeStart") => {
        logger.debug(`executing provider event: "${event}" for ${getProviderNames().join(", ")}`);
        return await Promise.all(
          providers
            .filter((x) => typeof x[event] === "function")
            .map((x) => Promise.resolve(x[event](app))),
        );
      },
      getProvider<T extends BaseProviderNames[K], K extends keyof BaseProviderNames & string>(
        name: K,
      ): T {
        return providers.find((x) => x.getName() === name) as T;
      },
    };
  })();
}
export async function createEventCollection(app: App, providers?: (BaseProvider & any)[]) {
  return (() => {
    const collectionContext = import.meta.glob("../events/*.event.ts", { eager: true });
    const events = Object.values(collectionContext).map((m: any) => m.default)
      .map((event: any) => new event(app));
    events.forEach((p: BaseEvent) => {
      if (providers) p.__registerProviders(providers);
      p.__registerApp(app);
    });
    return {
      providers: events,
      getProviderNames: () => events.map((x: BaseEvent) => x.eventName),
      prepare: async () => {
        return await Promise.all(events.map((x: BaseEvent) => Promise.resolve(x.__prepare())));
      },
      getProvider: <T>(name: string): T => events.find((x) => x.getName() === name),
    };
  })();
}
