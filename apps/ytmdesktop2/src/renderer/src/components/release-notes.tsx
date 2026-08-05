import type { ReleaseNoteEntry } from "@shared/utils/updater";
import { type ComponentProps, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { type MDXContent, markdownParser } from "@/lib/markdown-parser";
import { cn } from "@/lib/utils";

interface MarkdownBodyProps {
	markdown: string;
	className?: string;
}

const mdxComponents = {
	a: (props: ComponentProps<"a">) => (
		<a {...props} className={cn("text-primary underline-offset-2 hover:underline", props.className)} target="_blank" rel="noreferrer" />
	),
	img: (props: ComponentProps<"img">) => (
		<img {...props} className={cn("inline-block size-5 rounded-full align-middle ring-1 ring-border", props.className)} alt={props.alt ?? ""} />
	),
	ul: (props: ComponentProps<"ul">) => <ul {...props} className={cn("my-1 flex flex-col gap-1.5 pl-4 list-disc", props.className)} />,
	ol: (props: ComponentProps<"ol">) => <ol {...props} className={cn("my-1 flex flex-col gap-1.5 pl-4 list-decimal", props.className)} />,
	li: (props: ComponentProps<"li">) => <li {...props} className={cn("text-xs/relaxed text-muted-foreground", props.className)} />,
	p: (props: ComponentProps<"p">) => <p {...props} className={cn("text-xs/relaxed text-muted-foreground", props.className)} />,
	h1: (props: ComponentProps<"h1">) => <h3 {...props} className={cn("text-xs font-medium text-foreground", props.className)} />,
	h2: (props: ComponentProps<"h2">) => <h3 {...props} className={cn("text-xs font-medium text-foreground", props.className)} />,
	h3: (props: ComponentProps<"h3">) => <h4 {...props} className={cn("text-xs font-medium text-foreground", props.className)} />,
	code: (props: ComponentProps<"code">) => (
		<code {...props} className={cn("rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]", props.className)} />
	),
	hr: (props: ComponentProps<"hr">) => <hr {...props} className={cn("border-border", props.className)} />,
};

function MarkdownBody({ markdown, className }: MarkdownBodyProps) {
	const [Content, setContent] = useState<MDXContent | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setContent(null);
		setFailed(false);

		void markdownParser
			.parseReleaseNotes(markdown)
			.then((next) => {
				if (!cancelled) setContent(() => next);
			})
			.catch(() => {
				if (!cancelled) setFailed(true);
			});

		return () => {
			cancelled = true;
		};
	}, [markdown]);

	if (failed) {
		return <pre className={cn("whitespace-pre-wrap text-xs/relaxed text-muted-foreground", className)}>{markdown}</pre>;
	}

	if (!Content) {
		return (
			<div className={cn("flex flex-col gap-2", className)}>
				<Skeleton className="h-3 w-3/4" />
				<Skeleton className="h-3 w-full" />
			</div>
		);
	}

	return (
		<div className={cn("flex flex-col gap-1", className)}>
			<Content components={mdxComponents} />
		</div>
	);
}

interface ReleaseTimelineProps {
	releases: ReleaseNoteEntry[];
	className?: string;
}

export function ReleaseTimeline({ releases, className }: ReleaseTimelineProps) {
	if (!releases.length) {
		return <p className={cn("text-center text-xs text-muted-foreground", className)}>No release notes for this version.</p>;
	}

	return (
		<ol className={cn("relative flex flex-col", className)}>
			{/* single continuous rail — sits behind dots, never clipped by sticky bg */}
			<span
				className="pointer-events-none absolute top-4 bottom-4 left-[7px] z-0 w-px bg-border"
				aria-hidden
			/>

			{releases.map((release, index) => {
				const isNewest = index === 0;

				return (
					<li key={release.version} className="relative grid grid-cols-[16px_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0">
						{/* rail column — transparent, no sticky bg */}
						<div className="relative z-10 flex justify-center pt-3">
							<span className="relative flex size-4 items-center justify-center">
								{isNewest ? (
									<>
										<span className="absolute size-3 animate-ping rounded-full bg-green-500/40" aria-hidden />
										<span className="relative size-2.5 rounded-full bg-green-500 ring-2 ring-background" />
									</>
								) : (
									<span className="size-2 rounded-full bg-muted-foreground/50 ring-2 ring-background" />
								)}
							</span>
						</div>

						{/* content column */}
						<div className="min-w-0">
							<div className="sticky top-0 z-20 bg-background/95 py-2.5 backdrop-blur-sm">
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant={isNewest ? "default" : "outline"}>v{release.version}</Badge>
									{release.name ? <span className="truncate text-xs text-muted-foreground">{release.name}</span> : null}
								</div>
							</div>
							<div className="pt-1">
								{release.body ? (
									<MarkdownBody markdown={release.body} />
								) : (
									<p className="text-xs text-muted-foreground">No notes for this release.</p>
								)}
							</div>
						</div>
					</li>
				);
			})}
		</ol>
	);
}

/** @deprecated Prefer ReleaseTimeline — kept for single-blob fallback. */
export function ReleaseNotes({ markdown, className }: { markdown: string; className?: string }) {
	return <MarkdownBody markdown={markdown} className={className} />;
}
