"use client";

import Image from "next/image";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import type { Merchant } from "./markets";
import { useReducedMotion } from "./motion";

type Placement = {
  /** Where it floats, in Tailwind classes for phones and then `md:` up. */
  at: string;
  tilt: number;
  /** Which way the ask opens, toward the headline. */
  bubble: "below-start" | "below-end" | "above-start" | "above-end";
};

/**
 * Where the visitor's six stores (markets.ts) float around the hero's
 * headline. Phones get the four in the corners; the two in the middle only
 * fit beside the headline from `lg` up.
 */
const PLACEMENTS: readonly Placement[] = [
  {
    at: "left-[5%] top-3 md:left-[12%] md:top-[9%]",
    tilt: -12,
    bubble: "below-start",
  },
  {
    at: "right-[5%] top-5 md:right-[17%] md:top-[3%]",
    tilt: 15,
    bubble: "below-end",
  },
  {
    at: "hidden lg:block lg:left-[4%] lg:top-[36%]",
    tilt: 8,
    bubble: "below-start",
  },
  {
    at: "hidden lg:block lg:right-[3%] lg:top-[56%]",
    tilt: -9,
    bubble: "below-end",
  },
  {
    at: "bottom-4 left-[7%] md:bottom-[9%] md:left-[16%]",
    tilt: -22,
    bubble: "above-start",
  },
  {
    at: "right-[6%] bottom-2 md:right-[11%] md:bottom-[2%]",
    tilt: 16,
    bubble: "above-end",
  },
];

const BUBBLE: Record<Placement["bubble"], string> = {
  "below-start": "top-full left-1/2 mt-2.5 rounded-tl-md origin-top-left",
  "below-end": "top-full right-1/2 mt-2.5 rounded-tr-md origin-top-right",
  "above-start": "bottom-full left-1/2 mb-2.5 rounded-bl-md origin-bottom-left",
  "above-end": "bottom-full right-1/2 mb-2.5 rounded-br-md origin-bottom-right",
};

type Ghost = { at: string; size: number; tilt: number };

/**
 * Empty tiles between the store icons, for texture: pale, smaller, and only
 * from `md` up (the four nearest the headline's sides from `lg`).
 */
const GHOSTS: readonly Ghost[] = [
  { at: "hidden md:block left-[30%] top-[3%]", size: 36, tilt: 10 },
  { at: "hidden md:block right-[33%] top-0", size: 40, tilt: -8 },
  { at: "hidden lg:block left-[1%] top-[14%]", size: 44, tilt: -6 },
  { at: "hidden lg:block right-[6%] top-[19%]", size: 36, tilt: 12 },
  { at: "hidden lg:block left-[8%] bottom-[30%]", size: 40, tilt: 14 },
  { at: "hidden lg:block right-[13%] bottom-[22%]", size: 48, tilt: -14 },
  { at: "hidden md:block left-[31%] bottom-[4%]", size: 40, tilt: -4 },
  { at: "hidden md:block right-[30%] bottom-[11%]", size: 32, tilt: 8 },
];

/** How often a tile fills, and how long its store stays. */
const GHOST_EVERY_MS = 1800;
const GHOST_STAYS_MS = 3200;

function pick<T>(items: readonly T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * The empty tiles. Every couple of seconds one that's on screen takes a
 * store's logo for a moment, then empties again, never two of the same
 * store at once. They stay empty for visitors who ask for less motion.
 */
function GhostTiles({ stores }: { stores: readonly Merchant[] }) {
  const reduced = useReducedMotion();
  const tiles = useRef<(HTMLDivElement | null)[]>([]);
  const [filled, setFilled] = useState<
    Partial<Record<number, { store: Merchant; on: boolean }>>
  >({});

  useEffect(() => {
    if (reduced) {
      return;
    }
    let current: typeof filled = {};
    const timers = new Set<number>();
    function update(next: typeof filled) {
      current = next;
      setFilled(next);
    }
    const tick = window.setInterval(() => {
      const empty = GHOSTS.flatMap((_, index) =>
        !current[index]?.on && tiles.current[index]?.offsetParent
          ? [index]
          : [],
      );
      const showing = new Set(
        Object.values(current).flatMap((tile) =>
          tile?.on ? [tile.store.id] : [],
        ),
      );
      const index = pick(empty);
      const store = pick(stores.filter(({ id }) => !showing.has(id)));
      if (index === undefined || !store) {
        return;
      }
      update({ ...current, [index]: { store, on: true } });
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        update({ ...current, [index]: { store, on: false } });
      }, GHOST_STAYS_MS);
      timers.add(timer);
    }, GHOST_EVERY_MS);
    return () => {
      window.clearInterval(tick);
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [reduced, stores]);

  return GHOSTS.map(({ at, size, tilt }, index) => {
    const tile = filled[index];
    return (
      <div
        // biome-ignore lint/suspicious/noArrayIndexKey: the tiles are a fixed list.
        key={index}
        ref={(el) => {
          tiles.current[index] = el;
        }}
        aria-hidden="true"
        className={`rise absolute ${at}`}
        style={{ "--rise-delay": `${360 + index * 50}ms` } as CSSProperties}
      >
        <div
          className="float"
          style={
            {
              "--float-duration": `${6 + (index % 4)}s`,
              "--float-delay": `${-index * 0.9}s`,
            } as CSSProperties
          }
        >
          <div
            data-on={tile?.on || undefined}
            className="flex items-center justify-center rounded-[24%] border border-black/[0.04] bg-black/[0.035] transition-[background-color,box-shadow,border-color] duration-500 data-on:border-line data-on:bg-white data-on:shadow-[0_10px_24px_-12px_rgb(0_0_0/30%)]"
            style={{ width: size, height: size, rotate: `${tilt}deg` }}
          >
            {tile && (
              <Image
                key={tile.store.id}
                src={tile.store.logo}
                alt=""
                width={size}
                height={size}
                unoptimized
                className={`size-full rounded-[24%] object-contain transition duration-500 starting:scale-75 starting:opacity-0 ${tile.on ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}
              />
            )}
          </div>
        </div>
      </div>
    );
  });
}

/**
 * The visitor's stores' app icons floating around the hero's headline. Each
 * shows what you'd ask Menta for there (`ask`) in a chat bubble:
 * on hover, on keyboard focus, or on tap on touch screens (a mouse click
 * doesn't pin it open). They bob in place
 * (style.css, `.float`) and rest still for visitors who ask for less motion.
 */
export function FloatingStores({
  featured,
  ghosts,
}: {
  featured: readonly (Merchant & { ask: string })[];
  ghosts: readonly Merchant[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function close(event: PointerEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") {
          setOpen(null);
        }
        return;
      }
      if (!layer.current?.contains(event.target as Node)) {
        setOpen(null);
      }
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={layer} className="pointer-events-none absolute inset-0">
      <GhostTiles stores={ghosts} />
      {featured
        .slice(0, PLACEMENTS.length)
        .map(({ id: slug, logo, ask }, index) => {
          const { at, tilt, bubble } = PLACEMENTS[index] ?? PLACEMENTS[0];
          return (
            <div
              key={slug}
              className={`rise absolute ${at}`}
              style={
                { "--rise-delay": `${200 + index * 70}ms` } as CSSProperties
              }
            >
              <div
                className="float"
                style={
                  {
                    "--float-duration": `${5 + (index % 3)}s`,
                    "--float-delay": `${-index * 1.3}s`,
                  } as CSSProperties
                }
              >
                <button
                  type="button"
                  aria-expanded={open === slug}
                  data-open={open === slug || undefined}
                  onPointerUp={(event) => {
                    if (event.pointerType !== "mouse") {
                      setOpen((current) => (current === slug ? null : slug));
                    }
                  }}
                  className="group pointer-events-auto relative block cursor-pointer rounded-[22%] outline-none"
                >
                  <span
                    aria-hidden="true"
                    className="block size-12 overflow-hidden rounded-[22%] bg-white shadow-[0_12px_28px_-12px_rgb(0_0_0/45%)] ring-1 ring-black/5 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-0 group-focus-visible:scale-110 group-focus-visible:rotate-0 group-data-open:scale-110 group-data-open:rotate-0 md:size-16"
                    style={{ rotate: `${tilt}deg` }}
                  >
                    <Image
                      src={logo}
                      alt=""
                      width={64}
                      height={64}
                      unoptimized
                      className="size-full object-contain"
                    />
                  </span>
                  <span
                    className={`absolute z-10 w-max max-w-[220px] scale-90 rounded-[18px] border border-line bg-white px-3.5 py-2 text-left text-[14px] leading-snug text-ink opacity-0 shadow-[0_1px_2px_rgb(0_0_0/4%),0_10px_24px_-10px_rgb(0_0_0/22%)] transition duration-200 ease-out group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100 group-data-open:scale-100 group-data-open:opacity-100 md:max-w-[260px] ${BUBBLE[bubble]}`}
                  >
                    {ask}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
    </div>
  );
}
