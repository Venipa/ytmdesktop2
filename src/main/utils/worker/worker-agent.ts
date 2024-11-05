import { Worker, WorkerOptions } from "node:worker_threads";
import {
  MessageFromWorker,
  MessageToWorker,
  WorkerData,
  workerModuleId
} from "./protocol";

type GenericCallback = (...args: any[]) => void;

type WorkerEventSubscriptionMethod = (
  workerEvent: string,
  callback: GenericCallback
) => void;

export class WorkerAgent<TInput, TOutput> {
  private readonly worker: Worker;

  constructor(operationModuleId: string, logToConsole = false) {
    const workerData: WorkerData = {
      operationModuleId,
      logToConsole
    };

    const workerOptions: WorkerOptions = {
      workerData
    };

    this.worker = new Worker(workerModuleId, workerOptions);
  }

  runOperation(input: TInput): void {
    const message: MessageToWorker = {
      type: "operationInput",
      value: input
    };
    this.worker.postMessage(message);
  }

  requestExit(): void {
    const message: MessageToWorker = { type: "end" };
    this.worker.postMessage(message);
  }

  on(
    event: "result",
    callback: (err: Error | null, output: TOutput | null) => void
  ): this;
  on(event: "error", callback: (error: Error) => void): this;
  on(event: "exit", callback: (exitCode: number) => void): this;

  on(event: string, callback: GenericCallback): this {
    return this.registerEventListener(this.worker.on, event, callback);
  }

  once(
    event: "result",
    callback: (err: Error | null, output: TOutput | null) => void
  ): this;
  once(event: "error", callback: (error: Error) => void): this;
  once(event: "exit", callback: (exitCode: number) => void): this;

  once(event: string, callback: GenericCallback): this {
    return this.registerEventListener(this.worker.once, event, callback);
  }

  private registerEventListener(
    workerEventSubscriptionMethod: WorkerEventSubscriptionMethod,
    agentEvent: string,
    callback: GenericCallback
  ): this {
    switch (agentEvent) {
      case "result":
        this.registerResultListener(workerEventSubscriptionMethod, callback);
        break;

      case "exit":
      case "error":
        workerEventSubscriptionMethod.call(this.worker, agentEvent, callback);
        break;
    }

    return this;
  }

  private registerResultListener(
    workerSubscriptionMethod: WorkerEventSubscriptionMethod,
    callback: GenericCallback
  ): void {
    workerSubscriptionMethod.call(
      this.worker,
      "message",
      (message: MessageFromWorker) => {
        switch (message.type) {
          case "operationOutput":
            return callback(null, message.value);

          case "error":
            return callback(new Error(message.formattedError), null);
        }
      }
    );
  }
}