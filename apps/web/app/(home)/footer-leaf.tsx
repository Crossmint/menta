"use client";

import { useEffect, useRef } from "react";

/**
 * The footer's leaf: Menta's leaf (lib/brand.ts) stood upright as a hairline
 * outline, so huge and cropped by the page's end it rises like an arch. It
 * draws itself in once it scrolls into view, then sways (style.css).
 * Without JavaScript or for visitors who ask for less motion it's simply drawn.
 */
const OUTLINE =
  "M135 385C130 250 230 140 395 130C400 260 300 395 150 395C142 393 137 390 135 385Z";

export function FooterLeaf({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    svg.dataset.leaf = "waiting";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          observer.disconnect();
          svg.dataset.leaf = "drawn";
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  return (
    <svg
      ref={ref}
      data-leaf
      viewBox="166 66 200 390"
      fill="none"
      overflow="visible"
      aria-hidden="true"
      className={className}
    >
      {/* The outer group leans and sways; the inner one turns the leaf, traced from the icon (public/brand/icon.png, 512px), to point up. */}
      <g>
        <g transform="rotate(-45 265 260)">
          <path data-outline pathLength={1} d={OUTLINE} />
          <path data-vein pathLength={1} d="M150 375C210 320 280 270 297 222" />
        </g>
      </g>
    </svg>
  );
}
