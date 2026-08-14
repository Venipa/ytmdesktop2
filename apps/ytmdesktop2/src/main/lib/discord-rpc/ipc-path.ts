import { existsSync } from "node:fs";

const PACKAGED_DISCORD_DIRS = [
	"snap.discord",
	"snap.discord-ptb",
	"snap.discord-canary",
	"app/com.discordapp.Discord",
	"app/com.discordapp.DiscordPTB",
	"app/com.discordapp.DiscordCanary",
] as const;

export function linuxRuntimePrefix(runtimeDir: string): string {
	return runtimeDir
		.replace(/\/$/, "")
		.replace(/\/snap\.[^/]+$/, "")
		.replace(/\/app\/[^/]+$/, "");
}

export function linuxIpcCandidates(prefix: string, id: number): string[] {
	return [`${prefix}/discord-ipc-${id}`, ...PACKAGED_DISCORD_DIRS.map((dir) => `${prefix}/${dir}/discord-ipc-${id}`)];
}

export function pickExistingIpcPath(candidates: string[], exists: (path: string) => boolean): string {
	return candidates.find((path) => exists(path)) ?? candidates[0];
}

export function getIPCPath(id: number, exists: (path: string) => boolean = existsSync): string {
	if (process.platform === "win32") {
		return `\\\\?\\pipe\\discord-ipc-${id}`;
	}

	const dirtyPrefix = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || "/tmp";
	const prefix = linuxRuntimePrefix(dirtyPrefix);
	return pickExistingIpcPath(linuxIpcCandidates(prefix, id), exists);
}
