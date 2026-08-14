import { describe, expect, it } from "vitest";
import { linuxIpcCandidates, linuxRuntimePrefix, pickExistingIpcPath } from "./ipc-path";

describe("discord ipc path", () => {
	it("strips snap and flatpak runtime suffixes", () => {
		expect(linuxRuntimePrefix("/run/user/1000/snap.ytmdesktop2")).toBe("/run/user/1000");
		expect(linuxRuntimePrefix("/run/user/1000/app/net.venipa.ytmdesktop")).toBe("/run/user/1000");
		expect(linuxRuntimePrefix("/run/user/1000/")).toBe("/run/user/1000");
	});

	it("lists native socket before packaged Discord dirs", () => {
		const candidates = linuxIpcCandidates("/run/user/1000", 0);
		expect(candidates[0]).toBe("/run/user/1000/discord-ipc-0");
		expect(candidates).toContain("/run/user/1000/app/com.discordapp.Discord/discord-ipc-0");
	});

	it("prefers native socket when packaged Discord dir also exists", () => {
		const candidates = linuxIpcCandidates("/run/user/1000", 0);
		const existing = new Set(["/run/user/1000/discord-ipc-0", "/run/user/1000/app/com.discordapp.Discord/discord-ipc-0"]);
		expect(pickExistingIpcPath(candidates, (path) => existing.has(path))).toBe("/run/user/1000/discord-ipc-0");
	});

	it("uses Flatpak Discord socket when native is missing", () => {
		const candidates = linuxIpcCandidates("/run/user/1000", 0);
		const existing = new Set(["/run/user/1000/app/com.discordapp.Discord/discord-ipc-0"]);
		expect(pickExistingIpcPath(candidates, (path) => existing.has(path))).toBe(
			"/run/user/1000/app/com.discordapp.Discord/discord-ipc-0",
		);
	});

	it("falls back to native path when no socket exists (empty packaged dirs)", () => {
		const candidates = linuxIpcCandidates("/run/user/1000", 0);
		expect(pickExistingIpcPath(candidates, () => false)).toBe("/run/user/1000/discord-ipc-0");
	});
});
