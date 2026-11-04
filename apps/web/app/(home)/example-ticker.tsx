"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useReducedMotion } from "./motion";

/** One row: a bubble's height plus the gap below it. */
const ROW = 52;
const VISIBLE = 2;
const EVERY = 2600;

/**
 * Step 2's example asks, two at a time, moving up one every few seconds, so
 * the card stays as short as step 1's. Hovering it pauses it; the full
 * list is always in the markup for screen readers.
 */
export function ExampleTicker({ items }: { items: readonly ReactNode[] }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);
  // The first rows again at the end, so the last ask flows back into the first.
  const rows = [...items, ...items.slice(0, VISIBLE)];

  useEffect(() => {
    if (paused) {
      return;
    }
    const timer = window.setInterval(() => {
      setAnimate(true);
      setIndex((current) => current + 1);
    }, EVERY);
    return () => window.clearInterval(timer);
  }, [paused]);

  // Past the last ask, jump back to the start without moving (the copies look the same).
  useEffect(() => {
    if (index < items.length) {
      return;
    }
    const jump = window.setTimeout(
      () => {
        setAnimate(false);
        setIndex(0);
      },
      reduced ? 0 : 500,
    );
    return () => window.clearTimeout(jump);
  }, [index, items.length, reduced]);

  return (
    <div
      role="marquee"
      // Room past each edge, faded out, so an ask crossing it melts away
      // instead of being cut; the asks at rest sit inside the solid part.
      className="-my-3 overflow-hidden py-3 [mask-image:linear-gradient(transparent,#000_12px,#000_calc(100%-12px),transparent)]"
      style={{ height: ROW * VISIBLE - 8 + 24 }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <ul
        className="m-0 flex list-none flex-col items-start gap-2 p-0"
        style={{
          transform: `translateY(${-index * ROW}px)`,
          transition:
            animate && !reduced
              ? "transform 500ms cubic-bezier(0.22, 1, 0.36, 1)"
              : "none",
        }}
      >
        {rows.map((row, position) => {
          // The ask leaving at the top fades and shrinks away, and the next
          // fades in from below, instead of being cut at the edge.
          const shown = position >= index && position < index + VISIBLE;
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: the copies at the end repeat the first asks
              key={position}
              aria-hidden={position >= items.length ? true : undefined}
              className="flex h-11 max-w-full origin-left items-center"
              style={{
                opacity: shown ? 1 : 0,
                scale: shown ? 1 : 0.94,
                filter: shown ? "none" : "blur(2px)",
                transition:
                  animate && !reduced
                    ? "opacity 300ms ease-out, scale 500ms cubic-bezier(0.22, 1, 0.36, 1), filter 300ms ease-out"
                    : "none",
              }}
            >
              {row}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
