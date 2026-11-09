"use client";

import { useEffect } from "react";

/** How much later each piece that comes into view together starts, and the most it waits. */
const STAGGER_MS = 120;
const MAX_STEPS = 5;

/**
 * Brings the homepage in as you scroll: everything marked `data-reveal` that
 * starts below the fold waits hidden, then rises in once it's on screen, a
 * beat after whatever came into view with it (style.css). It plays once, and
 * without JavaScript or for visitors who ask for less motion everything
 * simply shows.
 */
export function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const waiting = [
      ...document.querySelectorAll<HTMLElement>("[data-reveal]"),
    ].filter((el) => el.getBoundingClientRect().top > window.innerHeight);
    for (const el of waiting) {
      el.dataset.reveal = "hidden";
    }
    const observer = new IntersectionObserver(
      (entries) => {
        let step = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          const el = entry.target as HTMLElement;
          observer.unobserve(el);
          el.style.setProperty(
            "--reveal-delay",
            `${Math.min(step++, MAX_STEPS) * STAGGER_MS}ms`,
          );
          el.dataset.reveal = "shown";
          const done = (event: AnimationEvent) => {
            if (event.target === el) {
              el.removeEventListener("animationend", done);
              delete el.dataset.reveal;
              el.style.removeProperty("--reveal-delay");
            }
          };
          el.addEventListener("animationend", done);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    for (const el of waiting) {
      observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);
  return null;
}
