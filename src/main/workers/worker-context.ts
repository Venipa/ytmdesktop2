import { exit } from "node:process";
import { parentPort, workerData } from "node:worker_threads";
import { createLogger } from "@shared/utils/console";
import { MessageFromWorker, MessageToWorker, WorkerData } from "./protocol";

const { operationModuleId, logToConsole } = workerData as WorkerData;

const logger = logToConsole ? createLogger(operationModuleId) : undefined;

logger?.info(`###> Trying to load module '${operationModuleId}'...`);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const operation = require(operationModuleId);

logger?.info(`###> Module loaded!`);

parentPort?.on("message", (message: MessageToWorker) => {
	switch (message.type) {
		case "operationInput":
			logger?.info(`###> Now running the operation!`);
			runOperation(message.value, message.correlationId);
			return;

		case "end":
			logger?.info(`###> Now exiting worker thread!`);
			setImmediate(() => exit(0));
			return;
	}
});

function runOperation(input: unknown, correlationId?: string): void {
	let operationOutput: unknown;

	try {
		operationOutput = operation(input);
	} catch (err: any) {
		logger?.error(`###> Error when calling the worker's operation: `, err);

		const message: MessageFromWorker = {
			correlationId,
			type: "error",
			formattedError: err,
		};
		parentPort?.postMessage(message);

		return;
	}

	logger?.info(`###> The operation result is: ${operationOutput}`);

	if (!(operationOutput instanceof Promise)) {
		logger?.info(`###> Sending the result to the parent!`);

		const message: MessageFromWorker = {
			correlationId,
			type: "operationOutput",
			value: operationOutput,
		};
		parentPort?.postMessage(message);

		return;
	}

	logger?.info(`###> Waiting for the promise to resolve...`);

	operationOutput
		.then((value) => {
			logger?.info(`###> Promise successful! Sending the result to the parent: ${value}`);

			const message: MessageFromWorker = {
				correlationId,
				type: "operationOutput",
				value,
			};
			parentPort?.postMessage(message);
		})
		.catch((operationError) => {
			logger?.error(`###> Promise failed! Sending an error message to the parent! The error is: `, operationError);

			const message: MessageFromWorker = {
				correlationId,
				type: "error",
				formattedError: operationError,
			};
			parentPort?.postMessage(message);
		});
}
