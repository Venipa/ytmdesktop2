import { type EvaluateOptions, evaluate } from "@mdx-js/mdx";
import { authorName, compareUrlParse } from "@shared/utils/github";
import type { MDXContent, MDXModule } from "mdx/types";
import type { ComponentType, ReactNode } from "react";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";

type MarkdownComponents = Record<string, ComponentType<Record<string, unknown>>>;

export interface MarkdownParseOptions {
	format?: "md" | "mdx";
	remarkPlugins?: EvaluateOptions["remarkPlugins"];
	components?: MarkdownComponents;
}

/**
 * Compiles markdown / MDX strings via `@mdx-js/mdx` into React components.
 */
export class MarkdownStringParser {
	private readonly baseOptions: EvaluateOptions;

	constructor(options: MarkdownParseOptions = {}) {
		this.baseOptions = {
			...runtime,
			baseUrl: import.meta.url,
			format: options.format ?? "md",
			remarkPlugins: options.remarkPlugins ?? [remarkGfm],
		} as EvaluateOptions;
	}

	/**
	 * Normalize GitHub release notes: contributor avatars + changelog links.
	 */
	preprocessReleaseNotes(content: string): string {
		const lines = content.split("\n");
		const next = lines.map((line) => {
			if (line.startsWith("- ")) {
				const mainContent = line.split(";")[0];
				const context = line.split(";")[2] ?? "@" + authorName;
				const mentions = context
					?.split(" ")
					.filter((word) => word.startsWith("@"))
					.map((mention) => {
						const username = mention.replace("@", "");
						const avatarUrl = `https://github.com/${username}.png`;
						return `[![${mention}](${avatarUrl})](https://github.com/${username})`;
					});
				if (!mentions?.length) return line;
				return mainContent.replace(/&nbsp/g, "") + " – " + mentions.join(" ");
			}
			if (compareUrlParse.test(line)) {
				compareUrlParse.lastIndex = 0;
				return line.replace(compareUrlParse, `[View on Github]($1)`);
			}
			return line;
		});
		return next.join("\n");
	}

	async parseModule(source: string, options: MarkdownParseOptions = {}): Promise<MDXModule> {
		return evaluate(source, {
			...this.baseOptions,
			...(options.format ? { format: options.format } : null),
			...(options.remarkPlugins ? { remarkPlugins: options.remarkPlugins } : null),
		} as EvaluateOptions);
	}

	async parse(source: string, options: MarkdownParseOptions = {}): Promise<MDXContent> {
		const mod = await this.parseModule(source, options);
		return mod.default;
	}

	async parseReleaseNotes(source: string): Promise<MDXContent> {
		return this.parse(this.preprocessReleaseNotes(source));
	}
}

export const markdownParser = new MarkdownStringParser();

export type { MDXContent, ReactNode };
