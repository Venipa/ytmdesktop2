import fs from "fs";
import path from "path";
import { is } from "@electron-toolkit/utils";
import logger from "@shared/utils/Logger";
import { LogLevel, Logger } from "@shared/utils/console";
import { ipcPromise } from "@shared/utils/ipcPromise";
import { format } from "date-fns";
import { WebContentsView, app } from "electron";
import { isProduction } from "./devUtils";

let isInitialized = false;

const fsLogger = () => {
	const logDir = path.join(app.getPath("userData"), "logs");
	if (!isProduction) console.log("logDir", logDir);
	if (!fs.existsSync(logDir)) {
		fs.mkdirSync(logDir, { recursive: true });
	}
	const logFile = path.join(logDir, `app_${format(new Date(), "yyyy-MM-dd")}.log`);
	logger.debug("logFile", logFile);
	const writeStream = fs.createWriteStream(logFile, {
		flags: "w+", // append and create if doesn't exist
		highWaterMark: 64 * 1024, // 64KB buffer size
		encoding: "utf8",
	});
	process.on("SIGINT", () => writeStream.end());
	process.on("SIGTERM", () => writeStream.end());
	process.on("SIGQUIT", () => writeStream.end());
	process.on("SIGBREAK", () => writeStream.end());
	process.on("uncaughtException", (err) => {
		console.error("[uncaughtException]:\n", err);
		writeStream.write(`[uncaughtException]: ${err.message}\n${err.stack}\n`);
	});
	process.on("unhandledRejection", (reason, promise) => {
		console.error("[unhandledRejection]:\n", reason);
		writeStream.write(`[unhandledRejection]: ${reason}\n${promise}\n`);
	});
	const allowedLevels = [LogLevel.Error, LogLevel.Warning];
	return (source: string, level: LogLevel, objects: any[] = []) => {
		if (!allowedLevels.includes(level)) return;
		writeStream.write(`[${source}][${level}]: ${[objects].flat().join(" ") ?? ""}\n`, () => {
			if (writeStream.writableEnded) {
				writeStream.end();
			}
		});
	};
};

export function initializeCustomElectronEnvironment() {
	if (isInitialized) {
		logger.error("app is already initializing");
		app.quit();
		process.exit(0);
	}

	if (!isProduction) {
		app.commandLine.appendSwitch("disable-web-security"); // disable cors (also disables other security features, allows webpack eval) - dev only
		app.commandLine.appendSwitch("disable-site-isolation-trials");
		console.log({ env: import.meta.env, isDev: is.dev });
	}
	process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

	if (import.meta.env.PROD && !process.env.DEBUG) {
		Logger.enableProductionMode();
		const fsOutput = fsLogger();
		Logger.outputs.push(fsOutput);
	} else {
		process.on("uncaughtException", (err) => {
			logger.error("Uncaught exception", err);
		});
		process.on("unhandledRejection", (reason, promise) => {
			logger.error("Unhandled rejection", reason);
		});
	}
	process.env.NODE_ENV = import.meta.env.MODE;
	WebContentsView.prototype.invoke = function <T>(channel: string, data: any) {
		return ipcPromise<T>(this, channel, data);
	};
	isInitialized = true;
}
