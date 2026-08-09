import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineBridge, definePageCmds } from "./define-bridge";

type MessageHandler = (ev: MessageEvent) => void;

function installWindowMock() {
	const listeners = new Set<MessageHandler>();
	const win = {
		addEventListener: (type: string, handler: MessageHandler) => {
			if (type === "message") listeners.add(handler);
		},
		removeEventListener: (type: string, handler: MessageHandler) => {
			if (type === "message") listeners.delete(handler);
		},
		postMessage: (data: unknown) => {
			const ev = { data } as MessageEvent;
			for (const handler of [...listeners]) handler(ev);
		},
		setTimeout: globalThis.setTimeout.bind(globalThis),
		clearTimeout: globalThis.clearTimeout.bind(globalThis),
	};
	vi.stubGlobal("window", win);
	return win;
}

describe("defineBridge", () => {
	beforeEach(() => {
		installWindowMock();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("request resolves with page listen result", async () => {
		const bridge = defineBridge({ name: "test_bridge", timeoutMs: 1000 });
		const dispose = bridge.listen({
			echo: (value) => `ok:${String(value)}`,
		});

		await expect(bridge.request<string>("echo", "hi")).resolves.toBe("ok:hi");
		dispose();
	});

	it("request rejects on handler throw", async () => {
		const bridge = defineBridge({ name: "test_bridge_err", timeoutMs: 1000 });
		const dispose = bridge.listen({
			boom: () => {
				throw new Error("nope");
			},
		});

		await expect(bridge.request("boom")).rejects.toThrow("nope");
		dispose();
	});

	it("request rejects on unknown cmd", async () => {
		const bridge = defineBridge({ name: "test_bridge_unknown", timeoutMs: 1000 });
		const dispose = bridge.listen({});

		await expect(bridge.request("missing")).rejects.toThrow(/unknown test_bridge_unknown cmd/);
		dispose();
	});

	it("notify invokes handler without reply", async () => {
		const bridge = defineBridge({ name: "test_bridge_notify", timeoutMs: 1000 });
		const spy = vi.fn();
		const dispose = bridge.listen({ ping: spy });

		bridge.notify("ping", 42);
		await vi.waitFor(() => expect(spy).toHaveBeenCalledWith(42));
		dispose();
	});

	it("pluginCmds forwards args to request", async () => {
		const bridge = defineBridge({ name: "test_bridge_cmds", timeoutMs: 1000 });
		const dispose = bridge.listen({
			add: (a, b) => Number(a) + Number(b),
		});
		const cmds = bridge.pluginCmds("add");

		await expect(cmds.add({}, 2, 3)).resolves.toBe(5);
		dispose();
	});

	it("request retries when listen attaches late", async () => {
		const bridge = defineBridge({ name: "test_bridge_late", timeoutMs: 40 });
		const pending = bridge.request<string>("echo", "late");
		await new Promise((r) => setTimeout(r, 60));
		const dispose = bridge.listen({
			echo: (value) => String(value),
		});
		await expect(pending).resolves.toBe("late");
		dispose();
	});
});

describe("definePageCmds", () => {
	beforeEach(() => {
		installWindowMock();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("wires pluginCmds + listen from one cmds map", async () => {
		const page = definePageCmds({
			name: "page_cmds",
			timeoutMs: 1000,
			cmds: {
				add: (a, b) => Number(a) + Number(b),
			},
		});
		const dispose = page.listen();

		await expect(page.pluginCmds.add({}, 2, 3)).resolves.toBe(5);
		await expect(page.request("add", 4, 5)).resolves.toBe(9);
		dispose();
	});

	it("notify hits the same handlers", async () => {
		const spy = vi.fn();
		const page = definePageCmds({
			name: "page_notify",
			timeoutMs: 1000,
			cmds: { ping: spy },
		});
		const dispose = page.listen();
		page.notify("ping", 7);
		await vi.waitFor(() => expect(spy).toHaveBeenCalledWith(7));
		dispose();
	});
});
