import { describe, expect, it } from "vitest";
import { formatSentryRelease } from "./sentry-release";

describe("formatSentryRelease", () => {
	it("uses version when hash is missing", () => {
		expect(formatSentryRelease("1.2.3", undefined)).toBe("ytmdesktop2@1.2.3");
		expect(formatSentryRelease("1.2.3", "")).toBe("ytmdesktop2@1.2.3");
	});

	it("appends a short git hash", () => {
		expect(formatSentryRelease("1.2.3", "abcdef012345")).toBe("ytmdesktop2@1.2.3+abcdef0");
	});
});
