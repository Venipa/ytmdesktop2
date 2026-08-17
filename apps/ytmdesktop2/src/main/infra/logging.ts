import { getRotatingFileSink } from "@logtape/file";
import { configureSync, getLogger, getTextFormatter, type LogLevel as LogTapeLevel } from "@logtape/logtape";
import { isAppQuitting } from "@main/handlers/quitPolicy";
import { formatLogArgs, Logger, LogLevel, type LogOutput, logger } from "@shared/utils/console";
import { app, dialog } from "electron";
import fs from "node:fs";
import path from "node:path";

/** Per-file soft cap before rotate. */
const MAX_LOG_FILE_BYTES = 5 * 1024 * 1024;
/** Keep newest N rotated files plus the active `app.log`. */
const MAX_LOG_FILES = 14;
const APP_LOG_CATEGORY = "ytmdesktop2" as const;
const APP_LOG_FILENAME = "app.log";

const LOGTAPE_BY_APP_LEVEL: Record<Exclude<LogLevel, LogLevel.Off>, LogTapeLevel> = {
	[LogLevel.Error]: "error",
	[LogLevel.Warning]: "warning",
	[LogLevel.Info]: "info",
	[LogLevel.Debug]: "debug",
};

let fileOutputAttached = false;
let processHandlersAttached = false;

/** `userData/logs` (dev uses ytmdesktop2-dev userData). */
export function getLogsDir(): string {
	return path.join(app.getPath("userData"), "logs");
}

export function ensureLogsDir(): string {
	const logDir = getLogsDir();
	fs.mkdirSync(logDir, { recursive: true });
	return logDir;
}

export function getAppLogFile(): string {
	return path.join(ensureLogsDir(), APP_LOG_FILENAME);
}

/** Drop oldest leftover `app_*.log` until at most MAX_LOG_FILES remain. */
function pruneOldLogs(): void {
	const logDir = getLogsDir();
	let names: string[];
	try {
		names = fs.readdirSync(logDir);
	} catch {
		return;
	}

	const files = names
		.filter((name) => /^app_.+\.log$/i.test(name))
		.map((name) => {
			const full = path.join(logDir, name);
			try {
				return { full, mtimeMs: fs.statSync(full).mtimeMs };
			} catch {
				return null;
			}
		})
		.filter((entry): entry is { full: string; mtimeMs: number } => entry !== null)
		.sort((a, b) => b.mtimeMs - a.mtimeMs);

	for (const stale of files.slice(MAX_LOG_FILES)) {
		try {
			fs.unlinkSync(stale.full);
		} catch {
			/* ignore */
		}
	}
}

function categoryForSource(source: string | undefined): readonly string[] {
	const parts = (source || "app").split(":").filter((part) => part.length > 0);
	return [APP_LOG_CATEGORY, ...(parts.length > 0 ? parts : ["app"])];
}

function createLogTapeOutput(): LogOutput {
	return (source, level, objects) => {
		if (level === LogLevel.Off) return;
		const tape = getLogger(categoryForSource(source));
		const message = formatLogArgs(objects);
		const error = objects.find((item): item is Error => item instanceof Error);
		const properties = error ? { error } : undefined;
		switch (LOGTAPE_BY_APP_LEVEL[level]) {
			case "error":
				tape.error(message, properties);
				break;
			case "warning":
				tape.warn(message, properties);
				break;
			case "info":
				tape.info(message, properties);
				break;
			default:
				tape.debug(message, properties);
		}
	};
}

function configureFileSink(): void {
	const logDir = ensureLogsDir();
	const logFile = getAppLogFile();
	pruneOldLogs();
	configureSync({
		sinks: {
			file: getRotatingFileSink(logFile, {
				maxSize: MAX_LOG_FILE_BYTES,
				maxFiles: MAX_LOG_FILES,
				bufferSize: 0,
				formatter: getTextFormatter({
					timestamp: "date-time",
					timeZone: null,
				}),
			}),
		},
		loggers: [
			{ category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["file"] },
			{ category: [APP_LOG_CATEGORY], lowestLevel: "warning", sinks: ["file"] },
		],
	});
	logger.info("log file", logFile, { maxBytes: MAX_LOG_FILE_BYTES, maxFiles: MAX_LOG_FILES, logDir });
}

let fatalErrorDialogShown = false;

function formatFatalReason(reason: unknown): string {
	if (reason instanceof Error) {
		const stack = reason.stack?.trim();
		return stack && stack.length > 0 ? stack : `${reason.name}: ${reason.message}`;
	}
	if (typeof reason === "string") return reason;
	try {
		return JSON.stringify(reason);
	} catch {
		return String(reason);
	}
}

function showFatalErrorDialog(kind: string, reason: unknown): void {
	if (fatalErrorDialogShown) return;
	fatalErrorDialogShown = true;
	try {
		dialog.showErrorBox(`YouTube Music for Desktop: ${kind}`, formatFatalReason(reason).slice(0, 4000));
	} catch {
		/* dialog can fail if Electron is tearing down */
	}
}

function attachProcessErrorHandlers() {
	if (processHandlersAttached) return;
	processHandlersAttached = true;
	process.on("uncaughtException", (err) => {
		logger.error("uncaughtException", err);
		if (isAppQuitting()) return;
		showFatalErrorDialog("uncaughtException", err);
	});
	process.on("unhandledRejection", (reason) => {
		logger.error("unhandledRejection", reason);
	});
}

/** Prod: warn+ to rotating logtape file sink. Always: process error handlers. */
export function attachAppLogging(options?: { file?: boolean }): void {
	attachProcessErrorHandlers();
	if (!options?.file || fileOutputAttached) return;
	fileOutputAttached = true;
	configureFileSink();
	Logger.outputs.push(createLogTapeOutput());
}
