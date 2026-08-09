import { describe, expect, it, vi } from "vitest";
import { createLyricsRenderer } from "./ui/render";

vi.mock("react-dom/client", () => {
	const unmount = vi.fn();
	const render = vi.fn();
	return {
		createRoot: vi.fn(() => ({ render, unmount })),
	};
});

describe("createLyricsRenderer", () => {
	it("destroy unmounts react root and clears host", async () => {
		const { createRoot } = await import("react-dom/client");
		const host = {
			replaceChildren: vi.fn(),
			classList: { remove: vi.fn() },
		} as unknown as HTMLElement;

		const api = createLyricsRenderer(() => host, {
			showTimeCodes: () => false,
			showProgressBar: () => true,
			showWordSync: () => false,
			onSeek: () => {},
		});

		expect(createRoot).toHaveBeenCalledWith(host);
		const root = vi.mocked(createRoot).mock.results[0]?.value as { unmount: ReturnType<typeof vi.fn> };

		api.destroy();
		expect(root.unmount).toHaveBeenCalled();
		expect(host.replaceChildren).toHaveBeenCalled();
	});
});
