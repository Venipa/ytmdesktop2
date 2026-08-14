import { isAppQuitting } from "@main/handlers/quitPolicy";
import { formatLogArgs, Logger, LogLevel, logLevelLabel, type LogOutput, logger } from "@shared/utils/console";
import { format } from "date-fns";
import { app, dialog } from "electron";
import fs, { type WriteStream } from "node:fs";
import path from "node:path";

/** Per-file soft cap before rotate. */
const MAX_LOG_FILE_BYTES = 5 * 1024 * 1024;
/** Keep newest N `app_*.log` files in logs dir (active + rotated). */
const MAX_LOG_FILES = 14;

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

function todayLogFile(): string {
	return path.join(ensureLogsDir(), `app_${format(new Date(), "yyyy-MM-dd")}.log`);
}

function fileSizeOrZero(filePath: string): number {
	try {
		return fs.statSync(filePath).size;
	} catch {
		return 0;
	}
}

function openLogStream(logFile: string): WriteStream {
	return fs.createWriteStream(logFile, {
		flags: "a",
		encoding: "utf8",
		highWaterMark: 64 * 1024,
	});
}

/** Drop oldest `app_*.log` until at most MAX_LOG_FILES remain. */
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

function rotateLogFile(activePath: string): string {
	const stamp = format(new Date(), "HHmmss");
	let rotated = activePath.replace(/\.log$/i, `.${stamp}.log`);
	if (fs.existsSync(rotated)) {
		rotated = activePath.replace(/\.log$/i, `.${stamp}.${Date.now()}.log`);
	}
	try {
		fs.renameSync(activePath, rotated);
	} catch {
		/* active may not exist yet */
	}
	pruneOldLogs();
	return todayLogFile();
}

function createFileLogOutput(): LogOutput {
	pruneOldLogs();

	let logFile = todayLogFile();
	let bytesWritten = fileSizeOrZero(logFile);
	let writeStream = openLogStream(logFile);
	logger.info("log file", logFile, { maxBytes: MAX_LOG_FILE_BYTES, maxFiles: MAX_LOG_FILES });

	const close = () => {
		if (!writeStream.destroyed) writeStream.end();
	};
	process.once("exit", close);
	process.once("SIGINT", close);
	process.once("SIGTERM", close);

	const minLevel = LogLevel.Warning;
	return (source, level, objects) => {
		if (level > minLevel || level === LogLevel.Off) return;
		const src = source || "app";
		const line = `${format(new Date(), "yyyy-MM-dd HH:mm:ss.SSS")} [${src}] ${logLevelLabel(level)}: ${formatLogArgs(objects)}\n`;
		const lineBytes = Buffer.byteLength(line, "utf8");

		if (bytesWritten > 0 && bytesWritten + lineBytes > MAX_LOG_FILE_BYTES) {
			if (!writeStream.destroyed) writeStream.end();
			logFile = rotateLogFile(logFile);
			bytesWritten = 0;
			writeStream = openLogStream(logFile);
		}

		writeStream.write(line);
		bytesWritten += lineBytes;
	};
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

/** Prod: warn+ to file. Always: process error handlers. */
export function attachAppLogging(options?: { file?: boolean }): void {
	attachProcessErrorHandlers();
	if (!options?.file || fileOutputAttached) return;
	fileOutputAttached = true;
	Logger.outputs.push(createFileLogOutput());
}
