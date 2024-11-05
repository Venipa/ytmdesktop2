import { join } from "node:path";

export const workerModuleId = join(__dirname, "worker");

export type WorkerData = {
  operationModuleId: string;
  logToConsole: boolean;
};

export type MessageToWorker =
  | {
      type: "operationInput";
      correlationId?: string;
      value: unknown;
    }
  | {
      type: "end";
    };

export type MessageFromWorker = { correlationId?: string } & (
  | {
      type: "operationOutput";
      value: unknown;
    }
  | {
      type: "error";
      formattedError: string;
    }
);