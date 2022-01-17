import { App } from "electron";
import { BaseEvent } from "./baseEvent";
import { BaseProvider } from "./baseProvider";

export async function createPluginCollection(app: App) {
  return (() => {
    const collectionContext = require.context(
      "../plugins",
      false,
      /plugin.ts$/i
    );
    const providers: (BaseProvider & any)[] = collectionContext
      .keys()
      .map(collectionContext)
      .map((m: any) => {
        return m.default;
      })
      .map((provider: any) => new provider(app));
    providers.forEach((p: BaseProvider) => p.__registerProviders(providers));
    return {
      providers,
      getProviderNames: () => providers.map((x: BaseProvider) => x.getName()),
      exec: async (
        event: "OnInit" | "OnDestroy" | "AfterInit" | "BeforeStart"
      ) => {
        return await Promise.all(
          providers
            .filter((x) => typeof x[event] === "function")
            .map((x) => Promise.resolve(x[event](app)))
        );
      },
      getProvider: <T>(name: string): T =>
        providers.find((x) => x.getName() === name),
    };
  })();
}
export async function createEventCollection(
  app: App,
  providers?: (BaseProvider & any)[]
) {
  return (() => {
    const collectionContext = require.context("../events", false, /event.ts$/i);
    const events = collectionContext
      .keys()
      .map(collectionContext)
      .map((m: any) => {
        return m.default;
      })
      .map((event: any) => new event(app));
    events.forEach((p: BaseEvent) => {
      if (providers) p.__registerProviders(providers);
      p.__registerApp(app);
    });
    return {
      providers: events,
      getProviderNames: () => events.map((x: BaseEvent) => x.eventName),
      prepare: async () => {
        return await Promise.all(events.map((x: BaseEvent) => Promise.resolve(x.__prepare())))
      },
      getProvider: <T>(name: string): T =>
        events.find((x) => x.getName() === name),
    };
  })();
}
