import { Worker, WorkerOptions } from "node:worker_threads";
import { createId as generateOperationId } from "@paralleldrive/cuid2";
import { MessageFromWorker, MessageToWorker, WorkerData, workerModuleId } from "./protocol";

type PromiseResolver<T> = (value: T) => void;

type PromiseRejector = (err: Error) => void;

export class PromiseAgent<TInput, TOutput> {
	private readonly worker: Worker;

	private readonly operationPromiseHandlesByCorrelationId = new Map<string, [PromiseResolver<TOutput>, PromiseRejector]>();

	private workerError?: Error;

	constructor(operationModuleId: string, logToConsole = false) {
		const workerData: WorkerData = {
			operationModuleId,
			logToConsole,
		};

		const workerOptions: WorkerOptions = {
			workerData,
		};

		this.worker = new Worker(workerModuleId, workerOptions)
			.on("message", this.handleWorkerMessage.bind(this))
			.on("error", this.handleWorkerError.bind(this))
			.on("messageerror", this.handleWorkerError.bind(this));
	}

	private handleWorkerMessage(message: MessageFromWorker): void {
		const correlationId = message.correlationId;
		if (!correlationId) {
			throw new Error("The message has no correlation id!");
		}

		const promiseHandles = this.operationPromiseHandlesByCorrelationId.get(correlationId);

		if (!promiseHandles) {
			throw new Error(`Unknown correlation id: '${message.correlationId}'`);
		}

		this.operationPromiseHandlesByCorrelationId.delete(correlationId);

		const [resolve, reject] = promiseHandles;

		switch (message.type) {
			case "operationOutput":
				resolve(message.value as TOutput);
				return;

			case "error":
				reject(new Error(message.formattedError));
				return;
		}
	}

	private handleWorkerError(err: Error): void {
		this.workerError = err;

		for (const [, reject] of this.operationPromiseHandlesByCorrelationId.values()) {
			reject(err);
		}

		this.operationPromiseHandlesByCorrelationId.clear();
	}

	runOperation(input: TInput): Promise<TOutput> {
		if (this.workerError) {
			return Promise.reject(this.workerError);
		}

		return new Promise<TOutput>((resolve, reject) => {
			const correlationId = generateOperationId();

			this.operationPromiseHandlesByCorrelationId.set(correlationId, [resolve, reject]);

			const message: MessageToWorker = {
				type: "operationInput",
				correlationId,
				value: input,
			};
			this.worker.postMessage(message);
		});
	}

	requestExit(): Promise<number> {
		if (this.workerError) {
			return Promise.resolve(1);
		}

		return new Promise<number>((resolve) => {
			this.worker.on("exit", resolve);

			const message: MessageToWorker = { type: "end" };
			this.worker.postMessage(message);
		});
	}
}
