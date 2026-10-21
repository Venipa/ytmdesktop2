import { afterEach, describe, expect, it, vi } from "vitest";
import { Logger, LogLevel, logger } from "./console";

describe("Logger resilience", () => {
	const originalLevel = Logger.level;

	afterEach(() => {
		vi.restoreAllMocks();
		Logger.outputs = [];
		Logger.level = originalLevel;
	});

	it("does not throw when the console transport throws (EPIPE)", () => {
		vi.spyOn(console, "error").mockImplementation(() => {
			const error = new Error("write EPIPE") as NodeJS.ErrnoException;
			error.code = "EPIPE";
			throw error;
		});

		expect(() => logger.error("an app error while stdout is a closed pipe")).not.toThrow();
	});

	it("does not throw when a log output throws", () => {
		Logger.outputs = [
			() => {
				throw new Error("disk full");
			},
		];

		expect(() => logger.warn("an app warning while the file sink is broken")).not.toThrow();
	});

	it("still emits to healthy outputs after a broken console transport", () => {
		vi.spyOn(console, "error").mockImplementation(() => {
			throw new Error("write EPIPE");
		});
		const received: string[] = [];
		Logger.outputs = [(_source, _level, objects) => received.push(String(objects[0]))];

		logger.error("kept for the file sink");

		expect(received).toEqual(["kept for the file sink"]);
	});

	it("respects the configured level", () => {
		Logger.level = LogLevel.Warning;
		const received: string[] = [];
		Logger.outputs = [(_source, _level, objects) => received.push(String(objects[0]))];

		logger.debug("debug is below the level");
		logger.warn("warning is emitted");

		expect(received).toEqual(["warning is emitted"]);
	});
});
