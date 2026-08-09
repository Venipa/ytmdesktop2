/** Slugify plugin cmd keys: `volumeUp` -> `volume_up`. */
export function pluginCommandKeySlug(cmd: string): string {
	return cmd.replace(/\.?(?=[A-Z])/g, "_").toLowerCase();
}

export function createPluginHandleName(name: string): string {
	return name.replace(/:/g, "_");
}

export function pluginCmdChannel(target: string, cmd: string): string {
	const handle = createPluginHandleName(target);
	const slug = pluginCommandKeySlug(cmd);
	return `plugins:${handle}:cmd:${slug}`;
}
