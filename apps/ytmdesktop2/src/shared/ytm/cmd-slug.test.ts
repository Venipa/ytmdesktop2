import { describe, expect, it } from "vitest";
import { pluginCmdChannel, pluginCommandKeySlug } from "./cmd-slug";

describe("ytm cmd slug", () => {
	it("slugs volumeUp to volume_up", () => {
		expect(pluginCommandKeySlug("volumeUp")).toBe("volume_up");
		expect(pluginCommandKeySlug("volumeDown")).toBe("volume_down");
	});

	it("builds api cmd channel with slug", () => {
		expect(pluginCmdChannel("api", "volumeUp")).toBe("plugins:api:cmd:volume_up");
		expect(pluginCmdChannel("api", "queue_add")).toBe("plugins:api:cmd:queue_add");
	});
});
