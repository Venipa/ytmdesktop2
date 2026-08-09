import { format } from "date-fns";

/** Off is never emitted; only used to silence Logger.level. */
export enum LogLevel {
	Off = 0,
	Error,
	Warning,
	Info,
	Debug,
}

export type LogOutput = (source: string | undefined, level: LogLevel, objects: unknown[]) => void;

const LEVEL_LABEL: Record<LogLevel, string> = {
	[LogLevel.Off]: "off",
	[LogLevel.Error]: "error",
	[LogLevel.Warning]: "warn",
	[LogLevel.Info]: "info",
	[LogLevel.Debug]: "debug",
};

export function logLevelLabel(level: LogLevel): string {
	return LEVEL_LABEL[level] ?? String(level);
}

/** Serialize log args for console/file (Errors keep stack). */
export function formatLogArgs(objects: unknown[]): string {
	return objects
		.map((item) => {
			if (item instanceof Error) return item.stack || item.message;
			if (typeof item === "string") return item;
			try {
				return JSON.stringify(item);
			} catch {
				return String(item);
			}
		})
		.join(" ");
}

export class Logger {
	static level = LogLevel.Debug;
	static outputs: LogOutput[] = [];

	static enableProductionMode() {
		Logger.level = LogLevel.Warning;
	}

	constructor(private source?: string) {}

	debug(...objects: unknown[]) {
		this.emit(console.debug, LogLevel.Debug, objects);
	}

	info(...objects: unknown[]) {
		this.emit(console.info, LogLevel.Info, objects);
	}

	warn(...objects: unknown[]) {
		this.emit(console.warn, LogLevel.Warning, objects);
	}

	error(...objects: unknown[]) {
		this.emit(console.error, LogLevel.Error, objects);
	}

	child(tag: string) {
		const next = this.source ? `${this.source}:${tag}` : tag;
		return new Logger(next);
	}

	private emit(func: (...args: unknown[]) => void, level: LogLevel, objects: unknown[]) {
		if (level > Logger.level) return;
		const prefix = this.source ? `${format(new Date(), "HH:mm:ss'.'SSS")} [${this.source}]` : null;
		func(...(prefix ? [prefix, ...objects] : objects));
		for (const output of Logger.outputs) {
			output(this.source, level, objects);
		}
	}
}

export const createLogger = (name?: string) => new Logger(name);
export const logger = createLogger("App");
