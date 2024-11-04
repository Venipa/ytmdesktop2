import { PromiseAgent } from "@giancosta86/worker-agent";
import logger from "@shared/utils/Logger";
import { BrowserWindow } from "electron";
import modulePathId from "./main?modulePath";
export interface ApiWorker {
  send(name: string, ...args: any[]): void;
  invoke<T = any>(name: string, ...args: any[]): Promise<T>;
  destroy(): Promise<void>;
}
export const createApiWorker = async (parent?: BrowserWindow): Promise<ApiWorker> => {
  logger.debug("Worker Added", modulePathId);
  const worker = new PromiseAgent(modulePathId);
  if (parent) parent.on("close", () => worker.requestExit());

  return new (class {
    constructor() {}
    send(name: string, ...args: any[]) {
      worker.runOperation({ name, data: args });
    }
    async invoke<T = any>(name: string, ...args: any[]) {
      return (await worker.runOperation({ name, data: args })) as Promise<T>;
    }
    async destroy() {
      if (!worker) return;
      await worker.runOperation({ name: "destroy" });
      await worker.requestExit();
    }
  })();
};
