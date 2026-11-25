import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resetSync } from "@logtape/logtape";
import { logger } from "@shared/utils/console";
import { app } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachAppLogging, attachStdioErrorHandlers, getAppLogFile } from "./logging";

vi.mock("electron", () => ({
	app: { getPath: vi.fn() },
	dialog: { showErrorBox: vi.fn() },
}));

vi.mock("@main/handlers/quitPolicy", () => ({
	isAppQuitting: () => false,
}));

describe("attachAppLogging file sink", () => {
	let userData: string;

	beforeEach(() => {
		userData = fs.mkdtempSync(path.join(os.tmpdir(), "ytmd-logs-"));
		vi.mocked(app.getPath).mockReturnValue(userData);
	});

	afterEach(() => {
		resetSync();
		fs.rmSync(userData, { recursive: true, force: true });
	});

	it("writes warn+ into userData/logs/app.log", () => {
		attachAppLogging({ file: true });
		const marker = `qa-rotating-sink-${Date.now()}`;
		logger.warn(marker);
		logger.info("should-not-hit-file");

		const logFile = getAppLogFile();
		expect(logFile).toBe(path.join(userData, "logs", "app.log"));
		const body = fs.readFileSync(logFile, "utf8");
		expect(body).toContain(marker);
		expect(body).not.toContain("should-not-hit-file");
	});
});


describe("attachStdioErrorHandlers", () => {
	it("ignores EPIPE from a closed stdio pipe instead of crashing", () => {
		const stream = new EventEmitter();
		attachStdioErrorHandlers([stream as never]);
		const error = Object.assign(new Error("write EPIPE"), { code: "EPIPE" });

		expect(() => stream.emit("error", error)).not.toThrow();
	});

	it("ignores streams destroyed during teardown", () => {
		const stream = new EventEmitter();
		attachStdioErrorHandlers([stream as never]);
		const error = Object.assign(new Error("destroyed"), { code: "ERR_STREAM_DESTROYED" });

		expect(() => stream.emit("error", error)).not.toThrow();
	});

	it("still surfaces unexpected stream errors", () => {
		const stream = new EventEmitter();
		attachStdioErrorHandlers([stream as never]);

		expect(() => stream.emit("error", new Error("unexpected stream failure"))).toThrow(
			"unexpected stream failure",
		);
	});
});
