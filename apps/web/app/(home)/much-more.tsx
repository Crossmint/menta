"use client";

import Image from "next/image";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { useMarket } from "./market";
import type { Merchant } from "./markets";
import { useReducedMotion } from "./motion";

/**
 * "And much more": what else people use Menta for, as pills with the
 * visitor's stores' icons among them. When the section comes into view they
 * fall from the top of the screen, one after another, and pile up at its
 * bottom, tumbling against each other (a small physics
 * step of its own, `step`). With a mouse you can pick them up and throw them. For visitors who
 * ask for less motion the pile is already there, settled.
 */

type Words = { title: string; items: readonly string[] };

/** How many store icons fall with the pills. */
const STORES = 8;

/** The visitor's stores, each once: the hero's, then the ones the use cases shop at, then the rest. */
function useStores(): Merchant[] {
  const market = useMarket();
  return useMemo(() => {
    const seen = new Set<string>();
    return [
      ...market.featured,
      ...Object.values(market.roles),
      ...market.ghosts,
    ]
      .filter(({ id }) => !seen.has(id) && Boolean(seen.add(id)))
      .slice(0, STORES);
  }, [market]);
}

type Path = { d: string; evenodd?: boolean };

const GLYPHS = {
  arrowPath: [
    {
      d: "M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z",
      evenodd: true,
    },
  ],
  paperAirplane: [
    {
      d: "M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z",
    },
  ],
  buildingOffice2: [
    {
      d: "M1 2.75A.75.75 0 0 1 1.75 2h10.5a.75.75 0 0 1 0 1.5H12v13.75a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75v-2.5a.75.75 0 0 0-.75-.75h-2.5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5H2v-13h-.25A.75.75 0 0 1 1 2.75ZM4 5.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1ZM4.5 9a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1ZM8 5.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1ZM8.5 9a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1ZM14.25 6a.75.75 0 0 0-.75.75V17a1 1 0 0 0 1 1h3.75a.75.75 0 0 0 0-1.5H18v-9h.25a.75.75 0 0 0 0-1.5h-4Zm.5 3.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Zm.5 3.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Z",
      evenodd: true,
    },
  ],
  heart: [
    {
      d: "m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.162-.682 22.045 22.045 0 0 1-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 0 1 8-2.828A4.5 4.5 0 0 1 18 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 0 1-3.744 2.582l-.019.01-.005.003h-.002a.739.739 0 0 1-.69.001l-.002-.001Z",
    },
  ],
  shoppingBag: [
    {
      d: "M6 5v1H4.667a1.75 1.75 0 0 0-1.743 1.598l-.826 9.5A1.75 1.75 0 0 0 3.84 19H16.16a1.75 1.75 0 0 0 1.743-1.902l-.826-9.5A1.75 1.75 0 0 0 15.333 6H14V5a4 4 0 0 0-8 0Zm4-2.5A2.5 2.5 0 0 0 7.5 5v1h5V5A2.5 2.5 0 0 0 10 2.5ZM7.5 10a2.5 2.5 0 0 0 5 0V8.75a.75.75 0 0 1 1.5 0V10a4 4 0 0 1-8 0V8.75a.75.75 0 0 1 1.5 0V10Z",
      evenodd: true,
    },
  ],
  shoppingCart: [
    {
      d: "M1 1.75A.75.75 0 0 1 1.75 1h1.628a1.75 1.75 0 0 1 1.734 1.51L5.18 3a65.25 65.25 0 0 1 13.36 1.412.75.75 0 0 1 .58.875 48.645 48.645 0 0 1-1.618 6.2.75.75 0 0 1-.712.513H6a2.503 2.503 0 0 0-2.292 1.5H17.25a.75.75 0 0 1 0 1.5H2.76a.75.75 0 0 1-.748-.807 4.002 4.002 0 0 1 2.716-3.486L3.626 2.716a.25.25 0 0 0-.248-.216H1.75A.75.75 0 0 1 1 1.75ZM6 17.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM15.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
    },
  ],
  musicalNote: [
    {
      d: "M17.721 1.599a.75.75 0 0 1 .279.583v11.29a2.25 2.25 0 0 1-1.774 2.2l-2.041.44a2.216 2.216 0 0 1-.938-4.332l2.662-.577a.75.75 0 0 0 .591-.733V6.112l-8 1.73v7.684a2.25 2.25 0 0 1-1.774 2.2l-2.042.44a2.216 2.216 0 1 1-.935-4.331l2.659-.573A.75.75 0 0 0 7 12.529V4.236a.75.75 0 0 1 .591-.733l9.5-2.054a.75.75 0 0 1 .63.15Z",
      evenodd: true,
    },
  ],
  key: [
    {
      d: "M8 7a5 5 0 1 1 3.61 4.804l-1.903 1.903A1 1 0 0 1 9 14H8v1a1 1 0 0 1-1 1H6v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 .293-.707L8.196 8.39A5.002 5.002 0 0 1 8 7Zm5-3a.75.75 0 0 0 0 1.5A1.5 1.5 0 0 1 14.5 7 .75.75 0 0 0 16 7a3 3 0 0 0-3-3Z",
      evenodd: true,
    },
  ],
  map: [
    {
      d: "M8.157 2.176a1.5 1.5 0 0 0-1.147 0l-4.084 1.69A1.5 1.5 0 0 0 2 5.25v10.877a1.5 1.5 0 0 0 2.074 1.386l3.51-1.452 4.26 1.762a1.5 1.5 0 0 0 1.146 0l4.083-1.69A1.5 1.5 0 0 0 18 14.75V3.872a1.5 1.5 0 0 0-2.073-1.386l-3.51 1.452-4.26-1.762ZM7.58 5a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5A.75.75 0 0 1 7.58 5Zm5.59 2.75a.75.75 0 0 0-1.5 0v6.5a.75.75 0 0 0 1.5 0v-6.5Z",
      evenodd: true,
    },
  ],
  cake: [
    {
      d: "m6.75.98-.884.883a1.25 1.25 0 1 0 1.768 0L6.75.98ZM13.25.98l-.884.883a1.25 1.25 0 1 0 1.768 0L13.25.98ZM10 .98l.884.883a1.25 1.25 0 1 1-1.768 0L10 .98ZM7.5 5.75a.75.75 0 0 0-1.5 0v.464c-1.179.304-2 1.39-2 2.622v.094c.1-.02.202-.038.306-.052A42.867 42.867 0 0 1 10 8.5c1.93 0 3.83.129 5.694.378.104.014.206.032.306.052v-.094c0-1.232-.821-2.317-2-2.622V5.75a.75.75 0 0 0-1.5 0v.318a45.645 45.645 0 0 0-1.75-.062V5.75a.75.75 0 0 0-1.5 0v.256c-.586.01-1.17.03-1.75.062V5.75ZM4.505 10.365A41.36 41.36 0 0 1 10 10c1.863 0 3.697.124 5.495.365C16.967 10.562 18 11.838 18 13.28v.693a3.72 3.72 0 0 1-1.665-.393 5.222 5.222 0 0 0-4.67 0 3.722 3.722 0 0 1-3.33 0 5.222 5.222 0 0 0-4.67 0A3.72 3.72 0 0 1 2 13.972v-.693c0-1.441 1.033-2.717 2.505-2.914ZM15.665 14.92a5.22 5.22 0 0 0 2.335.552V16.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 16.5v-1.028c.8 0 1.6-.184 2.335-.551a3.722 3.722 0 0 1 3.33 0c1.47.735 3.2.735 4.67 0a3.722 3.722 0 0 1 3.33 0Z",
    },
  ],
  gift: [
    {
      d: "M14 6a2.5 2.5 0 0 0-4-3 2.5 2.5 0 0 0-4 3H3.25C2.56 6 2 6.56 2 7.25v.5C2 8.44 2.56 9 3.25 9h6V6h1.5v3h6C17.44 9 18 8.44 18 7.75v-.5C18 6.56 17.44 6 16.75 6H14Zm-1-1.5a1 1 0 0 1-1 1h-1v-1a1 1 0 1 1 2 0Zm-6 0a1 1 0 0 0 1 1h1v-1a1 1 0 0 0-2 0Z",
      evenodd: true,
    },
    {
      d: "M9.25 10.5H3v4.75A2.75 2.75 0 0 0 5.75 18h3.5v-7.5ZM10.75 18v-7.5H17v4.75A2.75 2.75 0 0 1 14.25 18h-3.5Z",
    },
  ],
  truck: [
    {
      d: "M6.5 3c-1.051 0-2.093.04-3.125.117A1.49 1.49 0 0 0 2 4.607V10.5h9V4.606c0-.771-.59-1.43-1.375-1.489A41.568 41.568 0 0 0 6.5 3ZM2 12v2.5A1.5 1.5 0 0 0 3.5 16h.041a3 3 0 0 1 5.918 0h.791a.75.75 0 0 0 .75-.75V12H2Z",
    },
    {
      d: "M6.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM13.25 5a.75.75 0 0 0-.75.75v8.514a3.001 3.001 0 0 1 4.893 1.44c.37-.275.61-.719.595-1.227a24.905 24.905 0 0 0-1.784-8.549A1.486 1.486 0 0 0 14.823 5H13.25ZM14.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
    },
  ],
  buildingLibrary: [
    {
      d: "M9.674 2.075a.75.75 0 0 1 .652 0l7.25 3.5A.75.75 0 0 1 17 6.957V16.5h.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H3V6.957a.75.75 0 0 1-.576-1.382l7.25-3.5ZM11 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM7.5 9.75a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0v-5.5Zm3.25 0a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0v-5.5Zm3.25 0a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0v-5.5Z",
      evenodd: true,
    },
  ],
  identification: [
    {
      d: "M1 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V6Zm4 1.5a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm2 3a4 4 0 0 0-3.665 2.395.75.75 0 0 0 .416 1A8.98 8.98 0 0 0 7 14.5a8.98 8.98 0 0 0 3.249-.604.75.75 0 0 0 .416-1.001A4.001 4.001 0 0 0 7 10.5Zm5-3.75a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Zm0 6.5a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Zm.75-4a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5h-2.5Z",
      evenodd: true,
    },
  ],
  mapPin: [
    {
      d: "m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z",
      evenodd: true,
    },
  ],
  film: [
    {
      d: "M1 4.75C1 3.784 1.784 3 2.75 3h14.5c.966 0 1.75.784 1.75 1.75v10.515a1.75 1.75 0 0 1-1.75 1.75h-1.5c-.078 0-.155-.005-.23-.015H4.48c-.075.01-.152.015-.23.015h-1.5A1.75 1.75 0 0 1 1 15.265V4.75Zm16.5 7.385V11.01a.25.25 0 0 0-.25-.25h-1.5a.25.25 0 0 0-.25.25v1.125c0 .138.112.25.25.25h1.5a.25.25 0 0 0 .25-.25Zm0 2.005a.25.25 0 0 0-.25-.25h-1.5a.25.25 0 0 0-.25.25v1.125c0 .108.069.2.165.235h1.585a.25.25 0 0 0 .25-.25v-1.11Zm-15 1.11v-1.11a.25.25 0 0 1 .25-.25h1.5a.25.25 0 0 1 .25.25v1.125a.25.25 0 0 1-.164.235H2.75a.25.25 0 0 1-.25-.25Zm2-4.24v1.125a.25.25 0 0 1-.25.25h-1.5a.25.25 0 0 1-.25-.25V11.01a.25.25 0 0 1 .25-.25h1.5a.25.25 0 0 1 .25.25Zm13-2.005V7.88a.25.25 0 0 0-.25-.25h-1.5a.25.25 0 0 0-.25.25v1.125c0 .138.112.25.25.25h1.5a.25.25 0 0 0 .25-.25ZM4.25 7.63a.25.25 0 0 1 .25.25v1.125a.25.25 0 0 1-.25.25h-1.5a.25.25 0 0 1-.25-.25V7.88a.25.25 0 0 1 .25-.25h1.5Zm0-3.13a.25.25 0 0 1 .25.25v1.125a.25.25 0 0 1-.25.25h-1.5a.25.25 0 0 1-.25-.25V4.75a.25.25 0 0 1 .25-.25h1.5Zm11.5 1.625a.25.25 0 0 1-.25-.25V4.75a.25.25 0 0 1 .25-.25h1.5a.25.25 0 0 1 .25.25v1.125a.25.25 0 0 1-.25.25h-1.5Zm-9 3.125a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z",
      evenodd: true,
    },
  ],
} satisfies Record<string, Path[]>;

const ITEM_GLYPHS: readonly (keyof typeof GLYPHS)[] = [
  "arrowPath", // Manage subscriptions
  "paperAirplane", // Book flights
  "buildingOffice2", // Book hotels
  "heart", // Send flowers
  "shoppingBag", // Order takeout
  "shoppingCart", // Restock essentials
  "musicalNote", // Buy concert tickets
  "key", // Rent a car
  "map", // Book a train
  "cake", // Order a birthday cake
  "gift", // Buy gift cards
  "truck", // Order pet food
  "buildingLibrary", // Book museum tickets
  "identification", // Renew memberships
  "mapPin", // Book a ride
  "film", // Buy movie tickets
];

function Glyph({ name }: { name: keyof typeof GLYPHS }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className="size-3.5 flex-none text-muted md:size-4"
    >
      {GLYPHS[name].map(({ d, evenodd }: Path) => (
        <path
          key={d}
          d={d}
          fillRule={evenodd ? "evenodd" : undefined}
          clipRule={evenodd ? "evenodd" : undefined}
        />
      ))}
    </svg>
  );
}

/** A thing it does, with its icon a tone lighter than its words. */
function Pill({ children, index }: { children: string; index: number }) {
  const glyph = ITEM_GLYPHS[index];
  return (
    <span className="raised-light flex items-center gap-1.5 rounded-full border border-line bg-white py-1.5 pr-3 pl-2.5 text-[13px] whitespace-nowrap md:gap-2 md:py-2 md:pr-4 md:pl-3.5 md:text-[15px]">
      {glyph ? <Glyph name={glyph} /> : null}
      {children}
    </span>
  );
}

/** A store's app icon, as the hero shows it, with the pills' shadow. */
function Icon({ store }: { store: Merchant }) {
  return (
    <span className="raised-light block size-9 overflow-hidden rounded-[22%] bg-white md:size-11">
      <Image
        src={store.logo}
        alt=""
        width={44}
        height={44}
        unoptimized
        className="size-full object-contain"
      />
    </span>
  );
}

type Vec = { x: number; y: number };

/**
 * A piece as the physics sees it: a core of segments (in its own frame) with
 * `r` of padding around them. A pill is one segment, a capsule; an icon is
 * the edges and diagonals of a smaller square, a square with round corners.
 * `turn` is how far it turns before it looks the same again. Positions are
 * Verlet's: where it is and where it was a step ago, which is its velocity.
 */
type Body = {
  el: HTMLElement;
  w: number;
  h: number;
  core: [Vec, Vec][];
  corners: Vec[];
  r: number;
  /** How far from its middle it reaches, for a quick check before a close one. */
  reach: number;
  x: number;
  y: number;
  a: number;
  px: number;
  py: number;
  pa: number;
  /** Inverse mass and inverse moment of inertia. */
  im: number;
  ii: number;
  /** Falling or fallen; until then it waits above the screen. */
  live: boolean;
};

/** Gravity, in pixels per second squared, straight down. */
const GRAVITY = 1500;
const DOWN: Vec = { x: 0, y: GRAVITY };
const SUBSTEPS = 4;
const ITERATIONS = 2;
const DT = 1 / 60 / SUBSTEPS;
/** How much of its speed a piece keeps each step, moving and turning. */
const DAMPING = 0.998;
const SPIN_DAMPING = 0.98;
/** The fastest a piece moves (pixels) and turns (radians) in a step, so a throw can't fling it wildly. */
const TOP_SPEED = 5;
const TOP_SPIN = 0.04;
/** How hard contacts grip (friction), how much of an overlap a step undoes, and at most how far (pixels). */
const GRIP = 0.3;
const STIFFNESS = 0.85;
const MAX_UNDO = 3;
/** How firmly a held piece follows the pointer, and how much of its speed it keeps meanwhile. */
const HOLD = 0.08;
const HELD_DAMPING = 0.9;
/** How little a piece moves in a step (pixels) to count as at rest, and how long it can go on regardless. */
const SETTLED = 0.15;
const REST_AFTER_MS = 6000;
/** How long the title has to rise in before the first piece falls past it. */
const TITLE_LEAD_MS = 280;
/** How long between one piece starting to fall and the next. */
const DROP_EVERY_MS = 110;
/**
 * On phones nobody throws them, so the same fall plays faster (more steps a
 * frame) and they come one after another more quickly: the pile's there by
 * the time you've scrolled to it.
 */
const PHONE: Feel = { pace: 7, every: 60 };
/**
 * On phones that allow it without asking, tilting the phone tilts the pile:
 * gravity follows it, eased (`TILT_EASE` of the way each frame), always with
 * at least `MIN_DOWN` of it pulling down so nothing floats up out of the box.
 * A shake harder than `SHAKE` (m/s², gravity aside) tosses them about.
 */
const TILT_EASE = 0.15;
/** Phones are held mostly upright, so a tip sideways counts for more. */
const TILT_GAIN = 2;
const MIN_DOWN = 0.3;
const SHAKE = 14;
/** How much of an icon's side its round corners take. */
const CORNER = 0.22;

const cross = (a: Vec, b: Vec) => a.x * b.y - a.y * b.x;

/** A point of a body's, from its own frame to the box's. */
function world(b: Body, p: Vec): Vec {
  const c = Math.cos(b.a);
  const s = Math.sin(b.a);
  return { x: b.x + p.x * c - p.y * s, y: b.y + p.x * s + p.y * c };
}

/** The closest points between two segments (Ericson, Real-Time Collision Detection, 5.1.9). */
function closest(p1: Vec, q1: Vec, p2: Vec, q2: Vec): [Vec, Vec] {
  const d1 = { x: q1.x - p1.x, y: q1.y - p1.y };
  const d2 = { x: q2.x - p2.x, y: q2.y - p2.y };
  const r = { x: p1.x - p2.x, y: p1.y - p2.y };
  const a = d1.x * d1.x + d1.y * d1.y;
  const e = d2.x * d2.x + d2.y * d2.y;
  const f = d2.x * r.x + d2.y * r.y;
  let s = 0;
  let t = 0;
  if (a <= 1e-6 && e <= 1e-6) {
    return [p1, p2];
  }
  if (a <= 1e-6) {
    t = Math.min(1, Math.max(0, f / e));
  } else {
    const c = d1.x * r.x + d1.y * r.y;
    if (e <= 1e-6) {
      s = Math.min(1, Math.max(0, -c / a));
    } else {
      const b = d1.x * d2.x + d1.y * d2.y;
      const denom = a * e - b * b;
      s = denom > 1e-6 ? Math.min(1, Math.max(0, (b * f - c * e) / denom)) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = Math.min(1, Math.max(0, -c / a));
      } else if (t > 1) {
        t = 1;
        s = Math.min(1, Math.max(0, (b - c) / a));
      }
    }
  }
  return [
    { x: p1.x + d1.x * s, y: p1.y + d1.y * s },
    { x: p2.x + d2.x * t, y: p2.y + d2.y * t },
  ];
}

/** How a point on a body moved this step (its velocity, in Verlet). */
function motion(b: Body, arm: Vec): Vec {
  const turn = b.a - b.pa;
  return { x: b.x - b.px - turn * arm.y, y: b.y - b.py + turn * arm.x };
}

/** Pushes a body by `p` at `arm` from its middle, turning it as a push there would. */
function push(b: Body, arm: Vec, p: Vec) {
  b.x += p.x * b.im;
  b.y += p.y * b.im;
  b.a += cross(arm, p) * b.ii;
}

/** How hard a body is to push along `n` at `arm`. */
const give = (b: Body, arm: Vec, n: Vec) => b.im + b.ii * cross(arm, n) ** 2;

/**
 * Two bodies (or one and a wall, `b` null) touching at `armA`/`armB` from
 * their middles, overlapping by `depth` along `n` (from a to b): they're
 * pushed apart, and their sliding past each other there is held back by the
 * grip.
 */
function contact(
  a: Body,
  armA: Vec,
  b: Body | null,
  armB: Vec,
  n: Vec,
  depth: number,
) {
  // A piece pressed deep into another (dragged there, say) comes out over a
  // few steps rather than shooting out in one.
  const undo = Math.min(depth, MAX_UNDO) * STIFFNESS;
  const w = give(a, armA, n) + (b ? give(b, armB, n) : 0);
  const lambda = undo / w;
  push(a, armA, { x: -n.x * lambda, y: -n.y * lambda });
  if (b) {
    push(b, armB, { x: n.x * lambda, y: n.y * lambda });
  }
  // Friction: what's left of their sliding past each other, up to the grip.
  const va = motion(a, armA);
  const vb = b ? motion(b, armB) : { x: 0, y: 0 };
  const rel = { x: vb.x - va.x, y: vb.y - va.y };
  const along = rel.x * n.x + rel.y * n.y;
  const slide = { x: rel.x - n.x * along, y: rel.y - n.y * along };
  const length = Math.hypot(slide.x, slide.y);
  if (length < 1e-6) {
    return;
  }
  const t = { x: slide.x / length, y: slide.y / length };
  const wt = give(a, armA, t) + (b ? give(b, armB, t) : 0);
  const hold = Math.min(length, GRIP * undo) / wt;
  push(a, armA, { x: t.x * hold, y: t.y * hold });
  if (b) {
    push(b, armB, { x: -t.x * hold, y: -t.y * hold });
  }
}

/** Where two bodies overlap most, if they do: the closest points of their cores, and how deep. */
function overlap(a: Body, b: Body) {
  let best: { p: Vec; q: Vec; distance: number } | null = null;
  for (const [a1, a2] of a.core) {
    const p1 = world(a, a1);
    const p2 = world(a, a2);
    for (const [b1, b2] of b.core) {
      const [p, q] = closest(p1, p2, world(b, b1), world(b, b2));
      const distance = Math.hypot(q.x - p.x, q.y - p.y);
      if (!best || distance < best.distance) {
        best = { p, q, distance };
      }
    }
  }
  return best;
}

/**
 * A piece whose middle is inside the title (let go there, or pressed in) is
 * pushed straight out of its nearer side, top or bottom, rather than along
 * whatever its outline happens to cross. Says whether it was.
 */
function outOf(title: Body, piece: Body) {
  const corner = title.corners[2] as Vec;
  const dx = piece.x - title.x;
  const dy = piece.y - title.y;
  if (Math.abs(dx) > corner.x + title.r || Math.abs(dy) > corner.y + title.r) {
    return false;
  }
  const up = dy < 0;
  const depth = corner.y + title.r - Math.abs(dy) + piece.r;
  contact(
    title,
    { x: dx, y: 0 },
    piece,
    { x: 0, y: 0 },
    { x: 0, y: up ? -1 : 1 },
    depth,
  );
  return true;
}

/**
 * One step for every body that's falling, in a box `width` wide with its
 * floor at `floor`, pulled by `pull` (pixels per second squared).
 */
function step(
  bodies: Body[],
  width: number,
  floor: number,
  grab: Grab | null,
  pull: Vec = DOWN,
) {
  const gx = pull.x * DT * DT;
  const gy = pull.y * DT * DT;
  for (const b of bodies) {
    // The title (no mass) stays put.
    if (!b.live || !b.im) {
      continue;
    }
    const held = grab?.body === b ? HELD_DAMPING : 1;
    let vx = (b.x - b.px) * DAMPING * held;
    let vy = (b.y - b.py) * DAMPING * held;
    const speed = Math.hypot(vx, vy);
    if (speed > TOP_SPEED) {
      vx *= TOP_SPEED / speed;
      vy *= TOP_SPEED / speed;
    }
    const va = Math.max(
      -TOP_SPIN,
      Math.min(TOP_SPIN, (b.a - b.pa) * SPIN_DAMPING * held),
    );
    b.px = b.x;
    b.py = b.y;
    b.pa = b.a;
    b.x += vx + gx;
    b.y += vy + gy;
    b.a += va;
  }
  if (grab) {
    // The grabbed point is drawn toward the pointer, the rest hanging from it.
    const b = grab.body;
    const at = world(b, grab.local);
    const arm = { x: at.x - b.x, y: at.y - b.y };
    const to = { x: grab.x - at.x, y: grab.y - at.y };
    const distance = Math.hypot(to.x, to.y);
    if (distance > 1e-3) {
      const n = { x: to.x / distance, y: to.y / distance };
      const lambda = (distance * HOLD) / give(b, arm, n);
      push(b, arm, { x: n.x * lambda, y: n.y * lambda });
    }
  }
  for (let round = 0; round < ITERATIONS; round++) {
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i] as Body;
      if (!a.live) {
        continue;
      }
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j] as Body;
        if (!b.live) {
          continue;
        }
        const reach = a.reach + b.reach;
        if (Math.abs(a.x - b.x) > reach || Math.abs(a.y - b.y) > reach) {
          continue;
        }
        // The title: a held piece passes through it, so the pointer and the
        // title never fight over it; one let go inside it comes straight out.
        if (!a.im || !b.im) {
          const piece = a.im ? a : b;
          if (grab?.body !== piece && !outOf(a.im ? b : a, piece)) {
            const touch = overlap(a, b);
            const depth = touch ? a.r + b.r - touch.distance : 0;
            if (touch && depth > 0) {
              const n =
                touch.distance > 1e-6
                  ? {
                      x: (touch.q.x - touch.p.x) / touch.distance,
                      y: (touch.q.y - touch.p.y) / touch.distance,
                    }
                  : { x: 0, y: b.y < a.y ? -1 : 1 };
              contact(
                a,
                { x: touch.p.x - a.x, y: touch.p.y - a.y },
                b,
                { x: touch.q.x - b.x, y: touch.q.y - b.y },
                n,
                depth,
              );
            }
          }
          continue;
        }
        const touch = overlap(a, b);
        const depth = touch ? a.r + b.r - touch.distance : 0;
        if (!touch || depth <= 0) {
          continue;
        }
        const { p, q, distance } = touch;
        const n =
          distance > 1e-6
            ? { x: (q.x - p.x) / distance, y: (q.y - p.y) / distance }
            : { x: 0, y: 1 };
        contact(
          a,
          { x: p.x - a.x, y: p.y - a.y },
          b,
          { x: q.x - b.x, y: q.y - b.y },
          n,
          depth,
        );
      }
      // The floor and the sides, at each corner of its core.
      for (const corner of a.im ? a.corners : []) {
        const e = world(a, corner);
        const arm = { x: e.x - a.x, y: e.y - a.y };
        const below = e.y + a.r - floor;
        if (below > 0) {
          contact(a, arm, null, arm, { x: 0, y: 1 }, below);
        }
        const left = a.r - e.x;
        if (left > 0) {
          contact(a, arm, null, arm, { x: -1, y: 0 }, left);
        }
        const right = e.x + a.r - width;
        if (right > 0) {
          contact(a, arm, null, arm, { x: 1, y: 0 }, right);
        }
      }
    }
  }
}

/** A piece held by the pointer: where on it (in its own frame), and where the pointer is. */
type Grab = { body: Body; local: Vec; x: number; y: number };

/** Draws a body where it is, turned as it is, however it has landed. */
function place(b: Body) {
  b.el.style.transform = `translate3d(${b.x - b.w / 2}px, ${b.y - b.h / 2}px, 0) rotate(${b.a}rad)`;
}

/** Measures a piece (its size without the turn): a pill, or if it's square, an icon. */
function shape(b: Pick<Body, "el">) {
  const w = b.el.offsetWidth;
  const h = b.el.offsetHeight;
  const mass = (w * h) / 1000;
  const body = { w, h, im: 1 / mass, ii: 12 / (mass * (w * w + h * h)) };
  if (Math.abs(w - h) >= 2) {
    const half = (w - h) / 2;
    const ends: [Vec, Vec] = [
      { x: -half, y: 0 },
      { x: half, y: 0 },
    ];
    return {
      ...body,
      core: [ends],
      corners: ends,
      r: h / 2,
      reach: half + h / 2,
    };
  }
  const r = w * CORNER;
  const k = w / 2 - r;
  const [tl, tr, br, bl] = [
    { x: -k, y: -k },
    { x: k, y: -k },
    { x: k, y: k },
    { x: -k, y: k },
  ] as [Vec, Vec, Vec, Vec];
  return {
    ...body,
    // Its edges, and its diagonals so nothing slips inside it.
    core: [
      [tl, tr],
      [tr, br],
      [br, bl],
      [bl, tl],
      [tl, br],
      [tr, bl],
    ] as [Vec, Vec][],
    corners: [tl, tr, br, bl],
    r,
    reach: k * Math.SQRT2 + r,
  };
}

/**
 * The section's title as something to stand pieces on, where it is in the
 * box: a box round its words (not its line's leading), going nowhere, as it
 * has no mass.
 */
function ledge(title: HTMLElement, box: HTMLElement): Body {
  const at = title.getBoundingClientRect();
  const origin = box.getBoundingClientRect();
  const r = 6;
  const hw = at.width / 2 - r;
  const hh = at.height * 0.36 - r;
  const [tl, tr, br, bl] = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ] as [Vec, Vec, Vec, Vec];
  const x = at.left - origin.left + at.width / 2;
  const y = at.top - origin.top + at.height / 2;
  return {
    el: title,
    w: at.width,
    h: at.height,
    core: [
      [tl, tr],
      [tr, br],
      [br, bl],
      [bl, tl],
      [tl, br],
      [tr, bl],
    ],
    corners: [tl, tr, br, bl],
    r,
    reach: Math.hypot(hw, hh) + r,
    x,
    y,
    a: 0,
    px: x,
    py: y,
    pa: 0,
    im: 0,
    ii: 0,
    live: true,
  };
}

/**
 * Where across the box the `index`th piece falls: spread evenly over the
 * width (a golden-ratio sequence), so the pile comes out level, not in a heap
 * on one side.
 */
const across = (b: Body, index: number, width: number) =>
  b.w / 2 + ((index * 0.618034 + 0.31) % 1) * Math.max(0, width - b.w);

/** How far a body reaches up from where it is, as it's turned now. */
function top(b: Body) {
  return Math.min(...b.corners.map((corner) => world(b, corner).y)) - b.r;
}

/**
 * How tall the pile comes out at this width: the same drop worked out
 * beforehand, without drawing it, so the box fits it in any language, market
 * and screen rather than leaving a gap over it.
 */
function pileHeight(bodies: Body[], width: number, feel: Feel) {
  const floor = 4000;
  const trial = bodies.map((b) => ({ ...b, live: false }));
  let seed = 11;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  // Each falls from about a screen up, one every `feel.every`, as they will.
  const steps = Math.round((feel.every / 1000) * 60 * feel.pace);
  for (const [index, b] of trial.entries()) {
    b.x = across(b, index, width);
    b.y = floor - 900 - random() * 120;
    b.a = (random() - 0.5) * 0.3;
    b.px = b.x;
    b.py = b.y - 2;
    b.pa = b.a;
    b.live = true;
    for (let i = 0; i < steps; i++) {
      step(trial, width, floor, null);
    }
  }
  for (let i = 0; i < 700; i++) {
    step(trial, width, floor, null);
  }
  return floor - Math.min(...trial.map(top));
}

/** The box: the pile's height, a little more for how differently the real drop may land. */
const boxFor = (bodies: Body[], width: number, feel: Feel) =>
  Math.min(620, Math.max(120, pileHeight(bodies, width, feel) + 20));

/** How many steps the fall takes a frame, and how long between drops. */
type Feel = { pace: number; every: number };
const MOUSE: Feel = { pace: SUBSTEPS, every: DROP_EVERY_MS };

export function MuchMore({ t }: { t: Words }) {
  const stores = useStores();
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const pieces = useRef<(HTMLLIElement | null)[]>([]);
  const pieceKeys = [...t.items, ...stores.map(({ id }) => id)].join("|");

  // biome-ignore lint/correctness/useExhaustiveDependencies: `pieceKeys` changing means new pieces to measure and drop.
  useEffect(() => {
    const el = box.current;
    if (!el) {
      return;
    }
    const random = (() => {
      let seed = 3;
      return () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
    })();
    let width = el.clientWidth;
    // With a mouse, a piece can be picked up and thrown; on a phone, the pile
    // falls quicker and follows the phone's tilt.
    const fine = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    ).matches;
    const feel = fine ? MOUSE : PHONE;
    const bodies: Body[] = pieces.current.flatMap((piece) => {
      piece?.style.setProperty("visibility", "hidden");
      if (!piece) {
        return [];
      }
      return [
        {
          el: piece,
          ...shape({ el: piece }),
          x: 0,
          y: 0,
          a: 0,
          px: 0,
          py: 0,
          pa: 0,
          live: false,
        },
      ];
    });
    // They fall in a jumbled order, the stores among the pills.
    const order = bodies
      .map((body) => ({ body, key: random() }))
      .sort((a, b) => a.key - b.key)
      .map(({ body }) => body);
    // Until the pile's been worked out, the box keeps the height it's drawn with.
    let floor = el.clientHeight;
    const size = () => {
      floor = boxFor(order, width, feel);
      el.style.height = `${floor}px`;
    };

    /** Puts a piece somewhere across the top, `above` the box, a little turned. */
    const drop = (b: Body, index: number, above: number) => {
      b.x = across(b, index, width);
      b.y = -above - b.h - random() * 120;
      b.a = (random() - 0.5) * 0.3;
      b.px = b.x + (random() - 0.5) * 2;
      b.py = b.y - 2;
      b.pa = b.a + (random() - 0.5) * 0.006;
      b.live = true;
    };

    // Less motion: the pile, already settled, worked out before it shows.
    if (reduced) {
      size();
      for (const [index, b] of order.entries()) {
        drop(b, index, random() * floor * 2);
      }
      for (let i = 0; i < 900; i++) {
        step(order, width, floor, null);
      }
      for (const b of order) {
        b.el.style.visibility = "visible";
        place(b);
      }
      return;
    }

    let frame = 0;
    let started = 0;
    let dropped = 0;
    let still = 0;
    let grab: Grab | null = null;
    // The title, once someone has picked a piece up: the first fall goes past
    // it, but from then on a piece can be set down on it.
    let solid: Body | null = null;
    // When something last set it going: the last drop, or a grab.
    let stirred = 0;
    // Which way gravity pulls now, and which way the phone's tilt says it should.
    const pull = { ...DOWN };
    const aim = { ...pull };
    const tick = (time: number) => {
      frame = 0;
      if (!started) {
        started = time;
      }
      if (!stirred || grab) {
        stirred = time;
      }
      // The next ones start to fall from just above the top of the screen.
      const due = Math.min(
        order.length,
        Math.floor((time - started) / feel.every) + 1,
      );
      for (; dropped < due; dropped++) {
        const b = order[dropped] as Body;
        drop(b, dropped, el.getBoundingClientRect().top);
        b.el.style.visibility = "visible";
        stirred = time;
      }
      pull.x += (aim.x - pull.x) * TILT_EASE;
      pull.y += (aim.y - pull.y) * TILT_EASE;
      if (Math.hypot(aim.x - pull.x, aim.y - pull.y) > 1) {
        stirred = time;
      }
      for (let i = 0; i < feel.pace; i++) {
        step(solid ? [...order, solid] : order, width, floor, grab, pull);
      }
      let moving = 0;
      for (const b of order) {
        if (b.live) {
          moving = Math.max(
            moving,
            Math.abs(b.x - b.px),
            Math.abs(b.y - b.py),
            Math.abs(b.a - b.pa) * b.w,
          );
          place(b);
        }
      }
      // Settled (everything down and barely moving for a moment, gravity's
      // pull each step aside), or a while since anything set it going: it stops.
      still =
        dropped === order.length && moving < SETTLED && !grab ? still + 1 : 0;
      if (still < 30 && time - stirred < REST_AFTER_MS) {
        frame = requestAnimationFrame(tick);
      }
    };
    const wake = () => {
      still = 0;
      stirred = 0;
      if (!frame && started) {
        frame = requestAnimationFrame(tick);
      }
    };

    // They start falling once the section is well into view. Working out the
    // pile's height takes a moment, so it waits for the page to be idle, then
    // starts watching.
    const section = el.parentElement;
    section?.setAttribute("data-pile", "waiting");
    let lead = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !started && !lead) {
          observer.disconnect();
          section?.setAttribute("data-pile", "falling");
          lead = window.setTimeout(() => {
            frame = requestAnimationFrame(tick);
          }, TITLE_LEAD_MS);
        }
      },
      // On a phone they start a little sooner, as the box comes up.
      { threshold: fine ? 0.35 : 0.15 },
    );
    // Safari has no idle callbacks; a short wait does instead.
    const idle = (run: () => void) =>
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(run)
        : window.setTimeout(run, 300);
    const cancelIdle = (id: number) =>
      typeof window.cancelIdleCallback === "function"
        ? window.cancelIdleCallback(id)
        : window.clearTimeout(id);
    let waiting = idle(() => {
      size();
      observer.observe(el);
    });

    // A new width moves the walls at once; the pile's height is worked out
    // again once the resizing stops.
    let resizing = 0;
    const resize = new ResizeObserver(() => {
      if (el.clientWidth === width) {
        return;
      }
      width = el.clientWidth;
      // Pieces are smaller on phones, so a new width can mean new sizes.
      for (const b of bodies) {
        Object.assign(b, shape(b));
      }
      wake();
      window.clearTimeout(resizing);
      resizing = window.setTimeout(() => {
        cancelIdle(waiting);
        waiting = idle(() => {
          size();
          if (solid && title.current) {
            solid = ledge(title.current, el);
          }
          wake();
        });
      }, 200);
    });
    resize.observe(el);

    const local = (event: PointerEvent) => {
      const at = el.getBoundingClientRect();
      return { x: event.clientX - at.left, y: event.clientY - at.top };
    };
    const down = (event: PointerEvent) => {
      const body = order.find((b) => b.el.contains(event.target as Node));
      if (!body?.live) {
        return;
      }
      event.preventDefault();
      const p = local(event);
      const dx = p.x - body.x;
      const dy = p.y - body.y;
      const c = Math.cos(-body.a);
      const s = Math.sin(-body.a);
      grab = { body, local: { x: dx * c - dy * s, y: dx * s + dy * c }, ...p };
      if (!solid && title.current) {
        solid = ledge(title.current, el);
      }
      el.setPointerCapture(event.pointerId);
      el.style.cursor = "grabbing";
      wake();
    };
    const move = (event: PointerEvent) => {
      if (grab) {
        // Held inside the box, so it can't be pressed through the floor or the sides.
        const at = local(event);
        grab.x = Math.min(width, Math.max(0, at.x));
        grab.y = Math.min(floor, at.y);
      }
    };
    const up = () => {
      grab = null;
      el.style.removeProperty("cursor");
    };
    if (fine) {
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    }

    // On a phone, gravity follows the phone: down the screen held upright,
    // sideways tipped over. From the orientation's angles (W3C Z-X'-Y''), the
    // part of gravity along the screen, turned with it in landscape.
    const tilt = ({ beta, gamma }: DeviceOrientationEvent) => {
      if (beta === null || gamma === null) {
        return;
      }
      const b = (beta * Math.PI) / 180;
      const g = (gamma * Math.PI) / 180;
      const x = Math.cos(b) * Math.sin(g);
      const y = Math.sin(b);
      const turn = ((screen.orientation?.angle ?? 0) * Math.PI) / 180;
      const side = x * Math.cos(turn) + y * Math.sin(turn);
      const down = -x * Math.sin(turn) + y * Math.cos(turn);
      const next = {
        x: Math.max(-1, Math.min(1, side * TILT_GAIN)) * GRAVITY,
        y: Math.max(MIN_DOWN, down) * GRAVITY,
      };
      if (Math.hypot(next.x - aim.x, next.y - aim.y) > GRAVITY * 0.04) {
        Object.assign(aim, next);
        wake();
      }
    };
    // A shake tosses them up, each a little differently.
    let shook = 0;
    const shake = ({ acceleration, timeStamp }: DeviceMotionEvent) => {
      const force = Math.hypot(
        acceleration?.x ?? 0,
        acceleration?.y ?? 0,
        acceleration?.z ?? 0,
      );
      if (force < SHAKE || timeStamp - shook < 400 || !started) {
        return;
      }
      shook = timeStamp;
      for (const b of order) {
        if (b.live) {
          b.px = b.x + (random() - 0.5) * 6;
          b.py = b.y + 3 + random() * 4;
          b.pa = b.a + (random() - 0.5) * 0.06;
        }
      }
      wake();
    };
    // Tapping a piece makes it hop.
    const tap = (event: MouseEvent) => {
      const body = order.find((b) => b.el.contains(event.target as Node));
      if (body?.live) {
        body.py = body.y + 5;
        body.pa = body.a + (random() - 0.5) * 0.08;
        wake();
      }
    };
    // Only where the phone's motion is there without asking (not iPhones,
    // which would show a permission prompt).
    const free =
      typeof DeviceOrientationEvent !== "undefined" &&
      !("requestPermission" in DeviceOrientationEvent);
    if (!fine) {
      el.addEventListener("click", tap);
      if (free) {
        window.addEventListener("deviceorientation", tilt);
        window.addEventListener("devicemotion", shake);
      }
    }

    return () => {
      cancelAnimationFrame(frame);
      cancelIdle(waiting);
      window.clearTimeout(resizing);
      window.clearTimeout(lead);
      section?.removeAttribute("data-pile");
      observer.disconnect();
      resize.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("click", tap);
      window.removeEventListener("deviceorientation", tilt);
      window.removeEventListener("devicemotion", shake);
    };
  }, [reduced, pieceKeys]);

  pieces.current.length = t.items.length + stores.length;
  const all: { key: string; node: ReactNode }[] = [
    ...t.items.map((item, index) => ({
      key: item,
      node: <Pill index={index}>{item}</Pill>,
    })),
    ...stores.map((store) => ({
      key: store.id,
      node: <Icon store={store} />,
    })),
  ];

  return (
    <section className="group/pile mx-auto flex max-w-[1200px] flex-col items-center gap-2 px-4 pt-8 pb-2 md:gap-8 md:px-6 md:pt-16 md:pb-28">
      {/* It waits hidden until the section's in view (`data-pile`, set from
          the effect, so without JavaScript it simply shows), then rises in
          out of a blur just before the first pieces fall past it. */}
      <h3
        ref={title}
        className="m-0 text-center text-[28px] font-semibold tracking-[-0.03em] transition-[opacity,translate,filter] duration-700 ease-(--ease-spring) group-data-[pile=waiting]/pile:translate-y-4 group-data-[pile=waiting]/pile:opacity-0 group-data-[pile=waiting]/pile:blur-[6px] group-data-[pile=waiting]/pile:duration-0 md:text-[34px]"
      >
        {t.title}
      </h3>
      {/* What it lists, for screen readers; the pile itself is decoration. */}
      <ul className="sr-only">
        {t.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div
        ref={box}
        aria-hidden="true"
        className="relative h-[360px] w-full touch-pan-y select-none"
      >
        <ul className="m-0 list-none p-0">
          {all.map(({ key, node }, index) => (
            <li
              key={key}
              ref={(li) => {
                pieces.current[index] = li;
              }}
              style={{ visibility: "hidden" }}
              className="absolute top-0 left-0 z-10 w-max will-change-transform md:cursor-grab"
            >
              {node}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
