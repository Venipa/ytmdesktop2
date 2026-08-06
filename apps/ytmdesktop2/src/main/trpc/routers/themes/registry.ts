import defaultThemeScss from "@main/trpc/routers/themes/assets/default.scss?raw";
import type { ThemesConfig } from "./types";

export interface BundledTheme {
	id: string;
	name: string;
	source: string;
	kind: "scss";
}

export interface ThemeListItem {
	id: string;
	name: string;
	kind: "builtin" | "custom";
}

export type ResolvedThemeSource =
	| { type: "string"; id: string; value: string }
	| { type: "file"; id: "custom"; value: string };

export const BUNDLED_THEMES = {
	default: {
		id: "default",
		name: "Default",
		source: defaultThemeScss,
		kind: "scss" as const,
	},
} as const satisfies Record<string, BundledTheme>;

export function listThemes(): ThemeListItem[] {
	return [
		...Object.values(BUNDLED_THEMES).map((theme) => ({
			id: theme.id,
			name: theme.name,
			kind: "builtin" as const,
		})),
		{ id: "custom", name: "Custom", kind: "custom" },
	];
}

export function resolveActiveSource(config: ThemesConfig): ResolvedThemeSource | null {
	if (!config.enabled) return null;

	if (config.selected === "custom") {
		if (!config.customFile) return null;
		return { type: "file", id: "custom", value: config.customFile };
	}

	const bundled = BUNDLED_THEMES[config.selected as keyof typeof BUNDLED_THEMES];
	if (!bundled) return null;
	return { type: "string", id: bundled.id, value: bundled.source };
}

export { defaultThemeScss };
