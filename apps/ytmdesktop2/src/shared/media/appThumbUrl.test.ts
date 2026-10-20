import { describe, expect, it } from "vitest";
import { isAppThumbUrl, isCachableThumbUrl, toAppThumbUrl } from "./appThumbUrl";

describe("toAppThumbUrl", () => {
	it("maps ytimg https to ytmd-thumb", () => {
		const out = toAppThumbUrl("https://i.ytimg.com/vi/x/hqdefault.jpg");
		expect(out).toBeTruthy();
		expect(isAppThumbUrl(out!)).toBe(true);
	});

	it("maps protocol-relative ggpht to ytmd-thumb", () => {
		const out = toAppThumbUrl("//yt3.ggpht.com/a.jpg");
		expect(out).toBeTruthy();
		expect(isAppThumbUrl(out!)).toBe(true);
		expect(isCachableThumbUrl("//yt3.ggpht.com/a.jpg")).toBe(true);
	});

	it("drops non-cdn urls instead of passing them through", () => {
		expect(toAppThumbUrl("https://example.com/a.jpg")).toBeNull();
	});
});
