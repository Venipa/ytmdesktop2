"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { assetPath } from "@/lib/paths";

const EASE = [0.23, 1, 0.32, 1] as const;

const APP_SHOTS = [
  {
    src: "/images/player-full.png",
    title: "Player",
    alt: "YouTube Music Desktop playing a track in the main window",
    caption:
      "YouTube Music in a native window, with its own title bar, media keys, and the app settings one click away.",
  },
  {
    src: "/images/player-full-2.png",
    title: "Themes",
    alt: "YouTube Music Desktop with a custom theme and thumbnail background",
    caption:
      "Bundled or custom styles, the current thumbnail as a background, and glass blur behind the player.",
  },
  {
    src: "/images/features-lyrics-player.png",
    title: "Synced lyrics",
    alt: "YouTube Music Desktop showing timed lyrics for the playing track",
    caption: "Timed lyrics from Better Lyrics, Unison, and LRCLib, scrolling along with the track.",
  },
  {
    src: "/images/features-trayview.png",
    title: "Tray view",
    alt: "YouTube Music Desktop tray popup with now playing and queue",
    caption:
      "A now-playing popup anchored to the system tray: controls, progress, and the queue without opening the window.",
  },
] as const;

const frame =
  "relative aspect-[1533/927] overflow-hidden rounded-xl border border-fd-border bg-fd-card shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)]";

/** Hero screenshot: rises on load, then lays flat as it scrolls toward the reader. */
export function HeroShot() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion() === true;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 20%"] });
  const transform = useTransform(
    scrollYProgress,
    [0, 1],
    [
      "perspective(1600px) rotateX(18deg) scale(0.92)",
      "perspective(1600px) rotateX(0deg) scale(1)",
    ],
  );

  return (
    <motion.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, filter: "blur(8px)", y: 40 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ duration: 0.9, delay: 0.25, ease: EASE }}
      className="relative w-full"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[10%] -top-10 bottom-10 rounded-full bg-fd-primary/25 blur-[90px] dark:bg-fd-primary/20"
      />
      <motion.div
        style={reduce ? undefined : { transform, transformOrigin: "50% 0%" }}
        className={frame}
      >
        <Image
          src={assetPath(APP_SHOTS[0].src)}
          alt={APP_SHOTS[0].alt}
          fill
          sizes="(max-width: 1152px) 100vw, 1152px"
          priority
          className="object-cover object-top"
        />
      </motion.div>
    </motion.div>
  );
}

/** Pinned screenshot on the right swaps as each surface's copy scrolls past. */
export function SurfaceWalkthrough() {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion() === true;
  const items = useRef<Array<HTMLLIElement | null>>([]);

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
      <ol className="flex flex-col gap-14 lg:gap-0">
        {APP_SHOTS.map((shot, index) => (
          <motion.li
            key={shot.src}
            className="flex flex-col justify-center lg:min-h-[70vh]"
            onViewportEnter={() => setActive(index)}
            viewport={{ amount: 0.6 }}
          >
            <motion.div
              animate={{ opacity: active === index ? 1 : 0.35 }}
              transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
              className="max-lg:!opacity-100"
            >
              <h3 className="text-xl font-semibold tracking-tight md:text-2xl">{shot.title}</h3>
              <p className="mt-2 max-w-md leading-relaxed text-pretty text-fd-muted-foreground">
                {shot.caption}
              </p>
            </motion.div>
            <div className={cn(frame, "mt-5 lg:hidden")}>
              <Image
                src={assetPath(shot.src)}
                alt={shot.alt}
                fill
                sizes="100vw"
                className="object-cover object-top"
              />
            </div>
          </motion.li>
        ))}
      </ol>
      <div className="hidden lg:block">
        {/* Center the frame in the viewport; pt-11 offsets the dot row (mt-3 + h-8) below it. */}
        <div className="sticky top-0 flex h-screen flex-col justify-center pt-11">
          <div className={frame}>
            {APP_SHOTS.map((shot, index) => (
              <motion.div
                key={shot.src}
                className="absolute inset-0"
                initial={false}
                animate={
                  index === active
                    ? { opacity: 1, transform: "scale(1)", filter: "blur(0px)" }
                    : {
                        opacity: 0,
                        transform: reduce ? "scale(1)" : "scale(1.03)",
                        filter: reduce ? "blur(0px)" : "blur(6px)",
                      }
                }
                transition={{ duration: reduce ? 0.2 : 0.6, ease: EASE }}
                aria-hidden={index === active ? undefined : true}
              >
                <Image
                  src={assetPath(shot.src)}
                  alt={index === active ? shot.alt : ""}
                  fill
                  sizes="(max-width: 1152px) 60vw, 700px"
                  className="object-cover object-top"
                />
              </motion.div>
            ))}
          </div>
          <div className="mt-3 -ml-2 flex" role="group" aria-label="App screens">
            {APP_SHOTS.map((shot, index) => (
              <button
                key={shot.src}
                type="button"
                aria-label={shot.title}
                aria-current={index === active ? "true" : undefined}
                onClick={() =>
                  items.current[index]?.scrollIntoView({
                    block: "center",
                    behavior: reduce ? "auto" : "smooth",
                  })
                }
                className="group grid h-8 cursor-pointer place-items-center px-1"
              >
                <span
                  className={cn(
                    "h-1 rounded-full transition-[width,background-color] duration-300",
                    index === active
                      ? "w-6 bg-fd-primary"
                      : "w-1.5 bg-fd-border group-hover:w-3 group-hover:bg-fd-muted-foreground",
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Slow vertical drift for bento media; children must overflow the tile by ~8% top and bottom. */
export function Parallax({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion() === true;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const transform = useTransform(scrollYProgress, [0, 1], ["translateY(-6%)", "translateY(6%)"]);

  return (
    <motion.span ref={ref} style={reduce ? undefined : { transform }} className={className}>
      {children}
    </motion.span>
  );
}
