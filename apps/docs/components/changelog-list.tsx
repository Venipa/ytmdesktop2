"use client";

import { cn } from "@/lib/cn";
import { RELEASE_CHANNEL_LABELS, RELEASE_CHANNELS, type ReleaseChannel } from "@/lib/downloads";
import { ArrowUpRightIcon } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";

export interface ChangelogRelease {
  tag: string;
  name: string;
  url: string;
  date: string;
  prerelease: boolean;
  channel: ReleaseChannel | null;
  notes: string[];
}

const EASE = [0.23, 1, 0.32, 1] as const;

type Filter = "all" | ReleaseChannel;

export function ChangelogList({ releases }: { releases: ChangelogRelease[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = filter === "all" ? releases : releases.filter((r) => r.channel === filter);
  // Only offer channels that actually have releases.
  const filters: Array<{ id: Filter; label: string }> = [
    { id: "all", label: "All" },
    ...RELEASE_CHANNELS.filter((id) => releases.some((r) => r.channel === id)).map((id) => ({
      id,
      label: RELEASE_CHANNEL_LABELS[id],
    })),
  ];

  return (
    <div className="flex flex-col gap-10">
      <div
        className="inline-flex self-start rounded-full border border-fd-border p-0.5"
        role="radiogroup"
        aria-label="Release channel"
      >
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={cn(
              "cursor-pointer rounded-full px-3.5 py-1 text-sm transition-colors",
              filter === item.id
                ? "bg-fd-secondary text-fd-foreground"
                : "text-fd-muted-foreground hover:text-fd-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-fd-muted-foreground">No releases in this channel yet.</p>
      ) : (
        <ol className="divide-y divide-fd-border">
          {visible.map((release) => (
            <ReleaseRow key={release.tag} release={release} />
          ))}
        </ol>
      )}
    </div>
  );
}

function ReleaseRow({ release }: { release: ChangelogRelease }) {
  const ref = useRef<HTMLLIElement>(null);
  const reduce = useReducedMotion() === true;
  // Active while the row crosses the reading band just under the navbar.
  const active = useInView(ref, { margin: "-30% 0px -60% 0px" });

  return (
    <motion.li
      ref={ref}
      initial={reduce ? false : { opacity: 0, transform: "translateY(12px)" }}
      whileInView={{ opacity: 1, transform: "translateY(0px)" }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="grid gap-4 py-10 first:pt-0 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-10"
    >
      <div className="md:sticky md:top-24 md:self-start">
        <a
          href={release.url}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "font-mono text-lg font-semibold tabular-nums transition-colors duration-300 hover:underline",
            active ? "text-fd-primary" : "text-fd-foreground",
          )}
        >
          {release.tag}
        </a>
        <p className="mt-1 text-sm text-fd-muted-foreground">{release.date}</p>
        {release.prerelease ? (
          <span className="mt-2 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
            Pre-release
          </span>
        ) : null}
      </div>
      <div className="min-w-0">
        {release.name !== release.tag ? (
          <h2 className="text-xl font-semibold tracking-tight text-balance">{release.name}</h2>
        ) : null}
        {release.notes.length > 0 ? (
          <ul
            className={cn(
              "list-disc space-y-2 pl-4 leading-relaxed text-fd-muted-foreground marker:text-fd-border",
              release.name !== release.tag && "mt-4",
            )}
          >
            {release.notes.map((note, index) => (
              <li key={`${index}-${note}`} className="max-w-prose text-pretty">
                {note}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fd-muted-foreground">No release notes.</p>
        )}
        <a
          href={release.url}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-fd-primary hover:underline"
        >
          Open release
          <ArrowUpRightIcon className="size-3.5" />
        </a>
      </div>
    </motion.li>
  );
}
