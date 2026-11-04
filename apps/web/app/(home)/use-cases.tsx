"use client";

import Image from "next/image";
import {
  type CSSProperties,
  memo,
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useI18n } from "../../lib/i18n/client";
import { format } from "../../lib/i18n/format";
import { rich } from "../../lib/i18n/rich";
import { Check, Chevron, InlineLogo } from "../_components/icons";
import { localPrice } from "./currency";
import { HOSTS, type Host } from "./hosts";
import { useMarket } from "./market";
import type { Merchant, Role } from "./markets";
import { useReducedMotion } from "./motion";
import { MuchMore } from "./much-more";
import {
  ASK,
  Composer,
  Header,
  morph,
  REPLY,
  Receipt,
  rise,
  TrafficLights,
  WorldDemo,
} from "./world-demo";

/**
 * "What's easier with Menta?": five things it makes easier, each a chat in
 * the assistant it plays in (ChatGPT, Claude or Grok), at the visitor's own
 * stores (markets.ts), with Menta's card. It opens with the hero's demo. On
 * wide screens, scrolling flies that window down into the section, where it
 * becomes the first use case's. From there they play as a carousel, each
 * chat in turn, while the page scrolls on past them like any other section.
 * On phones, and for visitors who ask for less
 * motion, the demo stays put and the five simply stack. The chats are made
 * up, the same as the hero's.
 */

const CASES = ["groceries", "research", "party", "bills", "weekend"] as const;
type Case = (typeof CASES)[number];

/** The assistant each use case plays in, so Menta reads as a plugin, not an app of its own. */
const HOST: Record<Case, Host> = {
  groceries: "grok",
  party: "chatgpt",
  research: "claude",
  bills: "grok",
  weekend: "claude",
};

/** How long each beat of a chat waits before the next one shows. */
const BEATS: Record<Case, readonly number[]> = {
  groceries: [700, 1000, 1100, 900, 900, 2400],
  party: [700, 900, 2000],
  research: [700, 900, 1600, 1200],
  bills: [700, 1200],
  weekend: [700, 1800],
};

/** What a raised garden bed takes, in the order the agent lists it. */
const PARTS = ["boards", "brackets", "screws", "fabric", "soil"] as const;

/** The bill in the screenshot, in US dollars. */
const BILL_USD = 84;

/**
 * What each chat ends on: the Menta receipt for its order, at the visitor's
 * store for that part. The bill and the weekend end on their own cards.
 */
const RECEIPTS: Record<Case, { store: Role; usd: number } | null> = {
  groceries: { store: "grocery", usd: 124.6 },
  party: { store: "delivery", usd: 180 },
  research: { store: "marketplace", usd: 159 },
  bills: null,
  weekend: null,
};

/** The ease the switch between use cases rides on. */
const ease = "ease-[cubic-bezier(0.22,1,0.36,1)]";
/** A spring with a little overshoot (style.css), for what lands. */
const spring = "ease-(--ease-spring)";
/**
 * What plays in as the hero's window comes in to land (once the stage is
 * `data-arriving`), `--in` after it, and leaves the same way. Each one adds
 * where it waits, an offset its shown state undoes.
 */
const arrive = `transition-[opacity,translate,filter] duration-700 ${ease} [transition-delay:0ms] opacity-0 blur-[8px] group-data-[arriving]/stage:translate-0 group-data-[arriving]/stage:opacity-100 group-data-[arriving]/stage:blur-none group-data-[arriving]/stage:ease-(--ease-spring) group-data-[arriving]/stage:[transition-delay:var(--in,0ms)]`;

type Words = ReturnType<typeof useI18n>["m"]["landing"]["useCases"];

export function UseCases() {
  const { m } = useI18n();
  const t = m.landing.useCases;
  const reduced = useReducedMotion();
  const slot = useRef<HTMLDivElement>(null);
  const demo = useRef<HTMLElement>(null);
  const [leaving, setLeaving] = useState(false);

  return (
    <section className="bg-[#f7f7f6]">
      {/* Its rise lets go of its transform once it's done (`backwards`), or
          the window flying inside couldn't pin itself to the screen. */}
      <div
        style={{ animationFillMode: "backwards" }}
        className="rise mx-auto max-w-[1200px] px-4 pb-16 [--rise-delay:320ms] md:px-6 md:pb-24"
      >
        <div ref={slot}>
          <WorldDemo
            ref={demo}
            leaving={
              leaving
                ? { host: HOST[CASES[0]], title: t[CASES[0]].title }
                : null
            }
          />
        </div>
      </div>
      {reduced ? null : (
        <Pinned t={t} slot={slot} demo={demo} onLeaving={setLeaving} />
      )}
      <Stack t={t} reduced={reduced} />
      <MuchMore t={t.more} />
    </section>
  );
}

/** Phones, and less motion: the five one after another. */
const Stack = memo(function Stack({
  t,
  reduced,
}: {
  t: Words;
  reduced: boolean;
}) {
  return (
    <div
      className={`mx-auto max-w-[1200px] px-4 py-16 md:px-6 ${reduced ? "" : "md:hidden"}`}
    >
      <Title t={t} />
      <ol className="m-0 mt-10 flex list-none flex-col gap-16 p-0 md:gap-24">
        {CASES.map((kind, index) => (
          <Stacked key={kind} kind={kind} index={index} t={t} />
        ))}
      </ol>
    </div>
  );
});

function Title({ t }: { t: Words }) {
  return (
    <h2 className="m-0 text-center text-[34px] leading-[1.05] font-semibold tracking-[-0.045em] text-balance md:text-[48px] md:tracking-[-0.05em] lg:text-[56px]">
      {rich(t.title, { menta: <InlineLogo /> })}
    </h2>
  );
}

/** A use case's number, title and text. */
function Copy({ kind, index, t }: { kind: Case; index: number; t: Words }) {
  return (
    <>
      <span className="mascot-text text-[15px] font-semibold tabular-nums">
        {String(index + 1).padStart(2, "0")}
      </span>
      <h3 className="m-0 mt-2 text-[30px] leading-[1.1] font-semibold tracking-[-0.04em] text-balance md:text-[40px]">
        {t[kind].title}
      </h3>
      <p className="m-0 mt-3 max-w-[440px] text-[17px] text-pretty text-quiet md:text-[18px]">
        {t[kind].text}
      </p>
    </>
  );
}

/**
 * The strong ease-in-out the flight rides on, cubic-bezier(0.77, 0, 0.175, 1):
 * how far along it is at `x` of the way, solved by halving.
 */
function easeInOut(x: number) {
  const curve = (t: number, a: number, b: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 20; step++) {
    const mid = (low + high) / 2;
    if (curve(mid, 0.77, 0.175) < x) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return curve((low + high) / 2, 0, 1);
}

const lerp = (from: number, to: number, at: number) => from + (to - from) * at;

/** Where the flight starts: the demo's top this far down the screen (under the header). */
const FLIGHT_START = 80;
/**
 * How long scrolling has to stop for, partway through the flight, before the
 * page glides on to where it lands (or back to where it took off), so the
 * window is never left halfway.
 */
const SETTLE_MS = 180;
/** How far along the flight the title, the text and the rail start playing in. */
const ARRIVING = 0.6;
/** How much of a screen the stage holds still for once the window has landed, before the page scrolls on. */
const HOLD = 0.2;
/** How long a finished chat stays up before the carousel moves on to the next use case. */
const LINGER_MS = 2500;
/** How long each use case holds the stage: its chat, then the linger. */
const SHOWN_MS = Object.fromEntries(
  Object.entries(BEATS).map(([kind, beats]) => [
    kind,
    beats.reduce((sum, beat) => sum + beat, 0) + LINGER_MS,
  ]),
) as Record<Case, number>;

/** What the flight sets on the demo's parts, to clear when it's back home. */
const FLOWN = {
  slot: ["height"],
  demo: [
    "position",
    "z-index",
    "top",
    "left",
    "margin",
    "width",
    "contain",
    "will-change",
    "transform",
    "backdrop-filter",
    "opacity",
    "transition",
    "box-shadow",
    "pointer-events",
  ],
  screen: ["height", "transition-property"],
  side: ["width", "opacity", "border-right-width"],
  lift: ["opacity"],
} as const;

type Parts = Record<keyof typeof FLOWN, HTMLElement>;

/** The demo's parts the flight moves (world-demo.tsx marks them `data-flight`). */
function partsOf(slot: HTMLElement, demo: HTMLElement): Parts | null {
  const [screen, side, lift] = ["screen", "side", "lift"].map((name) =>
    demo.querySelector<HTMLElement>(`[data-flight="${name}"]`),
  );
  return screen && side && lift ? { slot, demo, screen, side, lift } : null;
}

/** Puts the hero's window back in its slot, as if it never flew. */
function land(parts: Parts) {
  for (const [part, properties] of Object.entries(FLOWN)) {
    for (const property of properties) {
      parts[part as keyof typeof FLOWN].style.removeProperty(property);
    }
  }
}

/**
 * Where the flight goes, measured while everything is at rest (and again
 * when the window resizes), so flying reads nothing from the page. Scroll
 * positions are in the page; `to` is on the screen, once the stage pins.
 */
type Course = {
  start: number;
  end: number;
  track: { top: number; height: number };
  from: { left: number; width: number; height: number; screen: number };
  to: { left: number; top: number; width: number; height: number };
};

function measure(
  parts: Parts,
  target: HTMLElement,
  track: HTMLElement,
): Course {
  const y = window.scrollY;
  const slot = parts.slot.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const stage = track.firstElementChild?.getBoundingClientRect() ?? to;
  const top = track.getBoundingClientRect().top + y;
  const width = parts.demo.offsetWidth;
  return {
    // Whole pixels, so a glide that lands on one is all the way there.
    start: Math.round(slot.top + y - FLIGHT_START),
    end: Math.round(top),
    track: { top, height: track.offsetHeight },
    from: {
      left: slot.left + (slot.width - width) / 2,
      width,
      height: parts.slot.offsetHeight,
      screen: parts.screen.offsetHeight,
    },
    to: {
      left: to.left,
      top: to.top - stage.top,
      width: to.width,
      height: to.height,
    },
  };
}

/**
 * Lifts the hero's window out of the page for the flight: its slot keeps its
 * place, and it's pinned to the screen, so the page scrolling under it can't
 * shake it (the browser scrolls a frame ahead of anything script moves).
 */
function takeOff(parts: Parts, course: Course) {
  const { slot, demo, screen } = parts;
  slot.style.height = `${course.from.height}px`;
  Object.assign(demo.style, {
    position: "fixed",
    // Over the use cases it flies into; only while it flies, so at home it
    // stays under the hero's menus.
    zIndex: "20",
    top: "0",
    left: "0",
    margin: "0",
    contain: "layout",
    willChange: "transform",
    // Its glass would blur the plain gray behind it every frame for nothing,
    // and a blur under a tilt flickers in Chrome.
    backdropFilter: "none",
  });
  // The window's own morph eases its height between assistants; here scroll drives it.
  screen.style.transitionProperty =
    "background-color, border-color, color, border-radius";
}

/**
 * The hero's window `progress` of the way into the stage: across the screen
 * from where it took off to where the stage's window sits, narrowing as its
 * sidebar folds away, lifted and a little tilted on the way. It's sized frame
 * by frame (with its chat cleared), since scaling would squash it. Both ends
 * are fixed on the screen, never read from the page, which scrolls a frame
 * ahead of it: it'd judder on a fast scroll.
 */
function fly(parts: Parts, course: Course, progress: number) {
  const { from, to } = course;
  const at = easeInOut(progress);
  // The lift and the tilt ride the same curve, so they settle as it does.
  const arc = Math.sin(Math.PI * at);
  const frame = from.height - from.screen;
  parts.demo.style.width = `${lerp(from.width, to.width, at)}px`;
  parts.demo.style.transform = `translate3d(${lerp(from.left, to.left, at)}px, ${lerp(FLIGHT_START, to.top, at)}px, 0) perspective(1400px) rotateX(${5 * arc}deg) rotateZ(${-1.2 * arc}deg)`;
  parts.screen.style.height = `${lerp(from.screen, to.height - frame, at)}px`;
  const fold = Math.min(1, progress * 2);
  parts.side.style.width = `${244 * (1 - fold)}px`;
  parts.side.style.opacity = String(1 - fold);
  parts.side.style.borderRightWidth = fold === 1 ? "0" : "";
  parts.lift.style.opacity = String(arc);
}

/**
 * Wide screens: the stage, pinned a moment in a track a little taller than
 * the screen. The hero's window flies in first and lands as the stage's
 * window, the title, the text and the rail playing in as it gets close. After
 * that it's a carousel: each chat plays, lingers and gives way to the next
 * (the last to the first), and the rail picks one. Scrolling only moves the
 * page on.
 */
// Kept out of the hero demo's renders while it flies.
const Pinned = memo(function Pinned({
  t,
  slot,
  demo,
  onLeaving,
}: {
  t: Words;
  slot: RefObject<HTMLDivElement | null>;
  demo: RefObject<HTMLElement | null>;
  onLeaving: (leaving: boolean) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const handoff = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  // Landed, and the stage still on screen: the photos are out and the chat plays.
  const [live, setLive] = useState(false);
  // The next use case, due once the active chat has finished (see `advance`).
  const next = useRef(0);
  const playing = useRef(false);
  playing.current = live;

  useEffect(() => {
    let frame = 0;
    let course: Course | null = null;
    let flying = false;
    let flown = 0;
    let down = false;
    let stale = false;
    // Where the page was, which way it last went, and the glide due once it stops.
    let lastY = window.scrollY;
    let going = 0;
    let settling = 0;
    /** Back in its slot with nothing flown: the hero's window, and the stage waiting for it. */
    const home = (parts: Parts) => {
      land(parts);
      flying = false;
      flown = 0;
      down = false;
      onLeaving(false);
      setLive(false);
      stage.current?.removeAttribute("data-arriving");
      handoff.current?.style.setProperty("opacity", "0");
    };
    const update = () => {
      frame = 0;
      const el = track.current;
      const parts =
        slot.current && demo.current
          ? partsOf(slot.current, demo.current)
          : null;
      if (!el || !parts || !target.current) {
        return;
      }
      // Phones hide the stage, and it stays home.
      if (!el.offsetHeight) {
        if (flown > 0) {
          home(parts);
        }
        stale = false;
        return;
      }
      // A resize changes the course: the window is set down in its slot to be
      // measured and takes off again on the new course in this same frame, so
      // nothing shows and the stage stays as it was. Its screen mustn't ease
      // its height while it's measured, or that reads it halfway.
      const resized = stale;
      stale = false;
      if (resized) {
        if (flying) {
          land(parts);
          flying = false;
        }
        parts.screen.style.transitionProperty = "none";
      }
      if (!flying) {
        course = measure(parts, target.current, el);
      }
      if (resized) {
        parts.screen.style.removeProperty("transition-property");
      }
      if (!course) {
        return;
      }
      const y = window.scrollY;
      if (y !== lastY) {
        going = Math.sign(y - lastY);
        lastY = y;
      }
      const top = course.track.top - y;

      // The flight follows the scroll exactly, however fast; stopping partway
      // glides on (see `settle`).
      const now = Math.min(
        1,
        Math.max(0, (y - course.start) / (course.end - course.start)),
      );
      let tookOff = false;
      if (now === 0) {
        if (flying) {
          land(parts);
          flying = false;
        }
      } else {
        if (!flying) {
          takeOff(parts, course);
          flying = true;
          tookOff = true;
        }
        // Once it's there it's hidden, so it needn't follow along.
        if (tookOff || now < 1 || flown < 1) {
          fly(parts, course, now);
        }
      }
      flown = now;
      onLeaving(flown > 0.02);
      stage.current?.toggleAttribute("data-arriving", flown > ARRIVING);
      // A little give, so stopping right on the line doesn't flick between the two.
      down = down ? flown > 0.985 : flown === 1;
      // The hero's window comes back as the first use case's, so the stage goes back to it.
      if (!down) {
        setActive(0);
      }
      const onStage = top + course.track.height > 0;
      setLive(down && onStage);
      // The handover happens here, in the same frame, rather than after a
      // render: the stage's window shows at once under the hero's, which then
      // fades away. On the way up the hero's fades in over the stage's (it has
      // no chat) before that one goes, so the swap doesn't blink.
      handoff.current?.style.setProperty(
        "transition",
        down ? "none" : "opacity 0s linear 150ms",
      );
      handoff.current?.style.setProperty("opacity", down ? "1" : "0");
      // It fades only on the stage; taking off already there (a resize, a
      // jump, a reload down the page) or with the stage gone, it's hidden at once.
      parts.demo.style.transition =
        tookOff || !onStage ? "none" : "opacity 150ms";
      parts.demo.style.opacity = down ? "0" : "";
      // Hidden, it mustn't catch the clicks meant for what's under it.
      parts.demo.style.pointerEvents = down ? "none" : "";
      // Fading off the stage's window, its shadow would darken that one's.
      parts.demo.style.boxShadow = down ? "none" : "";
    };
    /**
     * Stopped partway through the flight: the page glides on the way it was
     * going, to where the window lands or back to where it took off. The
     * flight follows the scroll, so it goes along; scrolling again calls it off.
     */
    const settle = () => {
      const y = window.scrollY;
      if (!course || y <= course.start || y >= course.end) {
        return;
      }
      window.scrollTo({
        top: going < 0 ? course.start : course.end,
        behavior: "smooth",
      });
    };
    const schedule = () => {
      if (!frame) {
        frame = requestAnimationFrame(update);
      }
    };
    const scroll = () => {
      schedule();
      window.clearTimeout(settling);
      settling = window.setTimeout(settle, SETTLE_MS);
    };
    const resize = () => {
      stale = true;
      schedule();
    };
    update();
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settling);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", resize);
      // Unmounted mid-flight (less motion, say), the window goes home.
      const parts =
        slot.current && demo.current
          ? partsOf(slot.current, demo.current)
          : null;
      if (parts) {
        land(parts);
      }
    };
  }, [slot, demo, onLeaving]);

  /**
   * A chat that's played to its end moves the carousel on to the next use
   * case a little later, the last back to the first. Picking one on the rail
   * first calls it off.
   */
  const advance = useCallback((kind: Case) => {
    window.clearTimeout(next.current);
    next.current = window.setTimeout(() => {
      if (playing.current) {
        setActive((CASES.indexOf(kind) + 1) % CASES.length);
      }
    }, LINGER_MS);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new use case calls off the one due
  useEffect(() => () => window.clearTimeout(next.current), [active, live]);

  return (
    <div
      ref={track}
      style={{ height: `${(1 + HOLD) * 100}svh` }}
      className="relative hidden md:block"
    >
      <div
        ref={stage}
        className="group/stage sticky top-0 flex h-svh flex-col justify-center gap-10 px-6 pt-20 pb-8 lg:gap-14"
      >
        <div className={`${arrive} translate-y-6`}>
          <Title t={t} />
        </div>
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-12 lg:gap-20">
          <div className="flex flex-col items-start gap-4 lg:gap-5">
            <div
              style={{ "--in": "150ms" } as CSSProperties}
              className={`${arrive} min-w-0 flex-1 -translate-x-6`}
            >
              <div className="grid">
                {CASES.map((kind, index) => (
                  <div
                    key={kind}
                    aria-hidden={index !== active}
                    className={`[grid-area:1/1] transition-[opacity,translate,filter] duration-700 ${ease} ${
                      index === active
                        ? "opacity-100 delay-150"
                        : `pointer-events-none opacity-0 blur-[6px] ${index < active ? "-translate-y-6" : "translate-y-6"}`
                    }`}
                  >
                    <Copy kind={kind} index={index} t={t} />
                  </div>
                ))}
              </div>
            </div>
            <Rail active={active} live={live} go={setActive} t={t} />
          </div>
          <div className="relative">
            <Floaters active={live ? active : -1} />
            {/* Hidden while the hero's window is on its way, then it takes over from it. */}
            <div ref={handoff} className="opacity-0">
              <ChatWindow
                ref={target}
                host={HOST[CASES[active] ?? "research"]}
                title={t[CASES[active] ?? "research"].title}
                className="h-[min(560px,calc(100svh-300px))] min-h-[420px]"
              >
                {CASES.map((kind, index) => (
                  <div
                    key={kind}
                    className={`[grid-area:1/1] min-h-0 transition-[opacity,translate,scale,filter] duration-500 ${ease} ${
                      index === active
                        ? "opacity-100 delay-100"
                        : `opacity-0 blur-[6px] ${index < active ? "-translate-y-4 scale-[0.98]" : "translate-y-4 scale-[0.98]"}`
                    }`}
                  >
                    <Chat
                      kind={kind}
                      playing={live && index === active}
                      onDone={advance}
                      t={t}
                    />
                  </div>
                ))}
              </ChatWindow>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

/** The rail's green, solid (the mascot's, without its gradient). */
const GREEN = "bg-[#10b45e]";

/**
 * Where you are in the use cases, in a row under their text: a dot for
 * each, green once you've passed it; the one you're on stretches into a bar
 * that fills while it's shown, until the carousel moves on. The chevrons step
 * to the one before or after. They come in one by one as the hero's window
 * arrives.
 */
function Rail({
  active,
  live,
  go,
  t,
}: {
  active: number;
  /** The chats are playing, so the bar fills (from the start each time). */
  live: boolean;
  go: (index: number) => void;
  t: Words;
}) {
  const step =
    "flex size-8 cursor-pointer items-center justify-center rounded-full text-quiet transition-colors hover:bg-black/5 hover:text-ink disabled:pointer-events-none disabled:opacity-25";
  const enter = (order: number) => ({
    style: { "--in": `${250 + order * 50}ms` } as CSSProperties,
    className: `transition-[opacity,scale] duration-500 ${ease} [transition-delay:0ms] scale-50 opacity-0 group-data-[arriving]/stage:scale-100 group-data-[arriving]/stage:opacity-100 group-data-[arriving]/stage:ease-(--ease-spring) group-data-[arriving]/stage:[transition-delay:var(--in,0ms)]`,
  });
  // Pulled left by the chevron's inset, so the row lines up with the text.
  return (
    <div className="-ml-[7px] flex flex-none items-center gap-1">
      <span {...enter(0)}>
        <button
          type="button"
          onClick={() => go(active - 1)}
          disabled={active === 0}
          aria-label={t.previous}
          className={step}
        >
          <Chevron width={18} height={18} className="rotate-180" />
        </button>
      </span>
      {CASES.map((kind, index) => (
        <span key={kind} {...enter(index + 1)}>
          <button
            type="button"
            onClick={() => go(index)}
            aria-label={t[kind].title}
            aria-current={index === active ? "step" : undefined}
            className="group flex h-8 cursor-pointer items-center px-1"
          >
            <span
              className={`relative h-2 overflow-hidden rounded-full transition-[width,background-color] duration-500 ${ease} ${
                index === active
                  ? "w-9 bg-[#10b45e]/20"
                  : index < active
                    ? `w-2 ${GREEN}`
                    : "w-2 bg-black/15 group-hover:bg-black/30"
              }`}
            >
              {index === active ? (
                <span
                  key={String(live)}
                  className={`rail-fill absolute inset-0 origin-left rounded-full ${GREEN}`}
                  style={{
                    animationDuration: `${SHOWN_MS[kind]}ms`,
                    animationPlayState: live ? "running" : "paused",
                  }}
                />
              ) : null}
            </span>
          </button>
        </span>
      ))}
      <span {...enter(CASES.length + 1)}>
        <button
          type="button"
          onClick={() => go(active + 1)}
          disabled={active === CASES.length - 1}
          aria-label={t.next}
          className={step}
        >
          <Chevron width={18} height={18} />
        </button>
      </span>
    </div>
  );
}

/** Where the floating photos sit: over the window's top corner, and in the space left of it. */
const SPOTS = {
  corner: "-top-12 -right-12 rotate-6",
  low: "bottom-[4%] right-[calc(100%+48px)] -rotate-6",
  high: "top-[2%] right-[calc(100%+72px)] -rotate-3",
} as const;

/** Photos of what each use case buys (public/products, see its CREDITS.md). */
const PHOTOS: Record<Case, { spot: keyof typeof SPOTS; src: string }[]> = {
  groceries: [
    { spot: "high", src: "/products/groceries.jpg" },
    { spot: "corner", src: "/products/lasagna.jpg" },
  ],
  research: [
    { spot: "corner", src: "/products/garden-bed.jpg" },
    { spot: "low", src: "/products/lumber.jpg" },
  ],
  party: [
    { spot: "high", src: "/products/pizza.jpg" },
    { spot: "low", src: "/products/wings.jpg" },
  ],
  bills: [
    { spot: "corner", src: "/products/bill.jpg" },
    { spot: "low", src: "/products/bulb.jpg" },
  ],
  weekend: [
    { spot: "high", src: "/products/lunch.jpg" },
    { spot: "corner", src: "/products/cinema.jpg" },
    { spot: "low", src: "/products/sunscreen.jpg" },
  ],
};

/**
 * Decoration: photos of what the active use case is buying float around the
 * window, a little tilted. They come in after the chat starts, bob gently,
 * and give way to the next use case's.
 */
function Floaters({ active }: { active: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 hidden lg:block"
    >
      {CASES.map((kind, caseIndex) =>
        PHOTOS[kind].map((photo, index) => (
          <div
            key={photo.src}
            style={{
              transitionDelay:
                caseIndex === active ? `${500 + index * 350}ms` : "0ms",
            }}
            className={`absolute w-max ${SPOTS[photo.spot]} transition-[opacity,scale,filter,translate] duration-700 ${
              caseIndex === active
                ? `opacity-100 ${spring}`
                : `translate-y-3 scale-75 opacity-0 blur-[6px] ${ease}`
            }`}
          >
            <div
              className="float"
              style={
                {
                  "--float-duration": `${5 + index}s`,
                  "--float-delay": `${-caseIndex * 1.3 - index}s`,
                } as CSSProperties
              }
            >
              <div className="raised-light rounded-[24px] border border-line bg-white p-1.5">
                <Image
                  src={photo.src}
                  alt=""
                  width={240}
                  height={240}
                  sizes="120px"
                  className="size-[120px] rounded-[18px] object-cover"
                />
              </div>
            </div>
          </div>
        )),
      )}
    </div>
  );
}

/** Phones, and less motion: each use case on its own, its chat playing once it scrolls into view. */
function Stacked({ kind, index, t }: { kind: Case; index: number; t: Words }) {
  const ref = useRef<HTMLLIElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <li
      ref={ref}
      className="grid grid-cols-1 items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-16"
    >
      <div>
        <Copy kind={kind} index={index} t={t} />
      </div>
      <ChatWindow
        host={HOST[kind]}
        title={t[kind].title}
        className="h-[480px] md:h-[540px]"
      >
        <div className="[grid-area:1/1] min-h-0">
          <Chat kind={kind} playing={inView} t={t} />
        </div>
      </ChatWindow>
    </li>
  );
}

/**
 * The assistant's window the chats play in, drawn like the hero's: its
 * colors and shapes, header and composer ease to the next assistant's. The
 * assistant's app icon floats on its corner, popping in as the host changes.
 */
function ChatWindow({
  ref,
  host,
  title,
  className,
  children,
}: {
  ref?: Ref<HTMLElement>;
  host: Host;
  title: string;
  className: string;
  children: ReactNode;
}) {
  const { m } = useI18n();
  return (
    <figure
      ref={ref}
      aria-hidden="true"
      className="bezel relative m-0 rounded-[30px] border border-white/80 p-2.5 backdrop-blur"
    >
      <div className="float absolute -top-4 -left-4 z-10 md:-top-5 md:-left-5">
        <Image
          key={host}
          src={`/assistants/${HOSTS[host].icon}.png`}
          alt=""
          width={56}
          height={56}
          className="size-12 -rotate-8 rounded-[22%] shadow-[0_12px_28px_-12px_rgb(0_0_0/45%)] ring-1 ring-black/5 transition duration-500 starting:scale-75 starting:opacity-0 md:size-14"
        />
      </div>
      <div
        style={HOSTS[host].vars}
        className={`bezel-screen flex flex-col overflow-hidden rounded-[22px] bg-(--host-bg) text-(--host-ink) ${morph} ${className}`}
      >
        <div className="flex h-12 flex-none items-center gap-3 px-4">
          <TrafficLights />
          <Header host={host} title={title} />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1">{children}</div>
        <div className="flex-none px-4 pt-2 pb-4">
          <Composer host={host} t={m.landing.demo.host} />
        </div>
      </div>
    </figure>
  );
}

/**
 * One use case's chat. It plays beat by beat from the start each time it
 * starts playing, and stays on its last beat; without motion it shows
 * finished. As it grows past the window it glides up, like a chat scrolling.
 */
// Only the chat that starts or stops playing renders again.
const Chat = memo(function Chat({
  kind,
  playing,
  onDone,
  t,
}: {
  kind: Case;
  playing: boolean;
  /** Called when it's played its last beat (not when it shows finished without motion). */
  onDone?: (kind: Case) => void;
  t: Words;
}) {
  const { m, tag } = useI18n();
  const reduced = useReducedMotion();
  const beats = BEATS[kind];
  const [beat, setBeat] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  // Start over before the first frame shows, so a chat coming back doesn't flash its end.
  useLayoutEffect(() => {
    if (playing) {
      setBeat(0);
    }
  }, [playing]);

  useEffect(() => {
    if (!playing || reduced || beat >= beats.length) {
      return;
    }
    const timer = window.setTimeout(() => {
      setBeat(beat + 1);
      if (beat + 1 === beats.length) {
        onDone?.(kind);
      }
    }, beats[beat]);
    return () => window.clearTimeout(timer);
  }, [playing, reduced, beat, beats, onDone, kind]);

  useEffect(() => {
    const outer = viewport.current;
    const inner = content.current;
    if (!outer || !inner) {
      return;
    }
    const observer = new ResizeObserver(() =>
      setOffset(Math.max(0, inner.offsetHeight - outer.clientHeight)),
    );
    observer.observe(inner);
    observer.observe(outer);
    return () => observer.disconnect();
  }, []);

  // Before it first plays, the ask is already there; without motion, all of it.
  const shown = reduced ? beats.length : beat;
  const market = useMarket();
  const receipt = RECEIPTS[kind];
  const store = receipt ? market.roles[receipt.store] : null;
  const host = HOST[kind];
  const words = t[kind];

  return (
    <div
      ref={viewport}
      className="h-full overflow-hidden [mask-image:linear-gradient(transparent,#000_28px)]"
    >
      <div
        ref={content}
        style={{ translate: `0 ${-offset}px` }}
        className={`mx-auto flex max-w-[520px] flex-col gap-3 px-4 pt-6 pb-2 transition-[translate] duration-700 sm:px-6 ${ease} motion-reduce:transition-none`}
      >
        {kind === "groceries" ? (
          <>
            <Voice host={host} seconds={4}>
              {t.groceries.voice}
            </Voice>
            {shown >= 1 ? (
              <Reply host={host}>
                {format(t.groceries.reply, {
                  store: market.roles.grocery.name,
                })}
              </Reply>
            ) : null}
            {shown >= 2 ? (
              <>
                <Day>{t.groceries.day}</Day>
                <Voice host={host} seconds={2}>
                  {t.groceries.more}
                </Voice>
              </>
            ) : null}
            {shown >= 3 ? <Reply host={host}>{t.groceries.added}</Reply> : null}
            {shown >= 4 ? <Ask host={host}>{t.groceries.buy}</Ask> : null}
            {shown >= 5 ? (
              <Groceries t={t} store={market.roles.grocery} />
            ) : null}
          </>
        ) : null}
        {kind === "party" ? (
          <>
            <Ask host={host}>{t.party.ask}</Ask>
            {shown >= 1 ? (
              <Reply host={host}>
                {format(t.party.reply, { store: market.roles.delivery.name })}
              </Reply>
            ) : null}
            {shown >= 2 ? <Party t={t} store={market.roles.delivery} /> : null}
          </>
        ) : null}
        {kind === "research" ? (
          <>
            <Ask host={host}>{t.research.ask}</Ask>
            {shown >= 1 ? (
              <Reply host={host}>
                {format(t.research.reply, {
                  store: market.roles.marketplace.name,
                })}
              </Reply>
            ) : null}
            {shown >= 2 ? (
              <Parts t={t} store={market.roles.marketplace} />
            ) : null}
            {shown >= 3 ? <Ask host={host}>{t.research.pick}</Ask> : null}
          </>
        ) : null}
        {kind === "bills" ? (
          <>
            <Screenshot t={t} />
            <Ask host={host}>{t.bills.ask}</Ask>
            {shown >= 1 ? <Reply host={host}>{t.bills.reply}</Reply> : null}
            {shown >= 2 ? <Paid t={t} /> : null}
          </>
        ) : null}
        {kind === "weekend" ? (
          <>
            <Ask host={host}>{t.weekend.ask}</Ask>
            {shown >= 1 ? <Reply host={host}>{t.weekend.reply}</Reply> : null}
            {shown >= 2 ? <Plans t={t} /> : null}
          </>
        ) : null}
        {store && receipt && "item" in words && shown >= beats.length ? (
          <Receipt
            store={store}
            item={words.item}
            usd={receipt.usd}
            tag={tag}
            t={m.landing.demo}
          />
        ) : null}
      </div>
    </div>
  );
});

function Ask({ host, children }: { host: Host; children: ReactNode }) {
  return (
    <div className="flex justify-end">
      <p
        className={`m-0 max-w-[82%] text-[14.5px] text-pretty ${ASK[host]} ${rise}`}
      >
        {children}
      </p>
    </div>
  );
}

function Reply({ host, children }: { host: Host; children: ReactNode }) {
  return <p className={`m-0 text-pretty ${REPLY[host]} ${rise}`}>{children}</p>;
}

/** A card in the chat, under the assistant's reply. */
function Card({ children }: { children: ReactNode }) {
  return (
    <div
      className={`raised-light flex flex-col rounded-[18px] border border-line bg-white p-1.5 ${rise}`}
    >
      {children}
    </div>
  );
}

/** Each row of a card comes in a beat after the one above it. */
const stagger = (index: number, step = 90) => ({
  animationDelay: `${index * step}ms`,
});

/** A voice note, as the assistant shows one: play, waveform, length, then what it said. */
function Voice({
  host,
  seconds,
  children,
}: {
  host: Host;
  seconds: number;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col items-end gap-1 ${rise}`}>
      <span
        className={`inline-flex items-center gap-2.5 text-[13px] ${ASK[host]}`}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M3 1.5v9l7.5-4.5z" />
        </svg>
        <span className="flex h-5 items-center gap-[3px]">
          {[6, 12, 9, 16, 10, 18, 8, 14, 11, 6, 13, 9, 15, 7].map(
            (height, index) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: a fixed waveform
                key={index}
                style={{ height }}
                className="w-[3px] rounded-full bg-current opacity-70"
              />
            ),
          )}
        </span>
        <span className="tabular-nums">0:0{seconds}</span>
      </span>
      <span className="max-w-[82%] px-2 text-right text-[12.5px] text-(--host-soft) italic">
        {children}
      </span>
    </div>
  );
}

/** A day passing between messages. */
function Day({ children }: { children: ReactNode }) {
  return (
    <div
      className={`my-1 flex items-center gap-3 text-[12px] font-medium text-(--host-soft) ${rise}`}
    >
      <span className="h-px flex-1 bg-(--host-line)" />
      {children}
      <span className="h-px flex-1 bg-(--host-line)" />
    </div>
  );
}

/** The bill's screenshot, sent before asking: a phone screen with the amount due. */
function Screenshot({ t }: { t: Words }) {
  const { tag } = useI18n();
  const market = useMarket();
  return (
    <div className={`flex justify-end ${rise}`}>
      <div className="flex w-36 flex-col gap-2 rounded-[16px] border border-line bg-white p-3 shadow-[0_6px_16px_-8px_rgb(0_0_0/25%)]">
        <span className="h-1.5 w-10 self-center rounded-full bg-line" />
        <span className="text-[12px] font-semibold">{t.bills.bill}</span>
        <span className="text-[20px] leading-none font-light tracking-[-0.03em] tabular-nums">
          {localPrice(tag, BILL_USD, market)}
        </span>
        <span className="text-[10.5px] text-muted">
          {format(t.bills.due, { date: dueDate(tag) })}
        </span>
        <span className="h-1.5 w-full rounded-full bg-chip" />
        <span className="h-1.5 w-3/4 rounded-full bg-chip" />
      </div>
    </div>
  );
}

/** The bill, paid. */
function Paid({ t }: { t: Words }) {
  const { tag } = useI18n();
  const market = useMarket();
  return (
    <Card>
      <div className="flex items-center gap-2.5 px-2.5 py-2 text-[13.5px]">
        <span className="min-w-0 flex-1 truncate font-medium">
          {t.bills.bill}
        </span>
        <span className="tabular-nums">
          {localPrice(tag, BILL_USD, market)}
        </span>
        <span className="mascot-fill inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[11px] font-semibold text-white">
          <Check width={10} height={10} />
          {t.bills.paid}
        </span>
      </div>
    </Card>
  );
}

/** The weekend, booked: a table, tickets and sunscreen, each at the visitor's store for it. */
function Plans({ t }: { t: Words }) {
  const market = useMarket();
  const rows = [
    { store: market.roles.tables, line: t.weekend.table },
    { store: market.roles.tickets, line: t.weekend.tickets },
    { store: market.roles.marketplace, line: t.weekend.sunscreen },
  ];
  return (
    <Card>
      {rows.map(({ store, line }, index) => (
        <div
          key={line}
          style={stagger(index, 400)}
          className={`flex items-center gap-3 px-2.5 py-2 ${rise}`}
        >
          <StoreTile store={store} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[14px] font-medium">
              {store.name}
            </span>
            <span className="truncate text-[12.5px] text-muted">{line}</span>
          </span>
          <span className="mascot-fill inline-flex size-5 flex-none items-center justify-center rounded-full text-white">
            <Check width={11} height={11} />
          </span>
        </div>
      ))}
    </Card>
  );
}

/** A list card: the store at the top, then its lines checking in one by one, each with an optional note. */
function List({
  store,
  label,
  lines,
  notes,
  columns = 1,
}: {
  store: Merchant;
  label: string;
  lines: readonly string[];
  notes?: readonly string[];
  columns?: 1 | 2;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-2">
        <StoreTile store={store} small />
        <span className="text-[13.5px] font-medium">{store.name}</span>
        <span className="ml-auto text-[12px] text-muted">{label}</span>
      </div>
      <ul
        className={`m-0 grid list-none gap-x-3 gap-y-1.5 border-t border-dashed border-line-strong px-2.5 pt-2.5 pb-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {lines.map((line, index) => (
          <li
            key={line}
            // Two columns fill twice as fast, so a long cart is in before the receipt.
            style={stagger(index, columns === 2 ? 150 : 220)}
            className={`flex min-w-0 items-center gap-2 text-[13px] ${rise}`}
          >
            <span className="mascot-fill inline-flex size-4 flex-none items-center justify-center rounded-full text-white">
              <Check width={10} height={10} />
            </span>
            {notes ? (
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{line}</span>
                <span className="truncate text-[12px] text-muted">
                  {notes[index]}
                </span>
              </span>
            ) : (
              <span className="truncate">{line}</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Groceries({ t, store }: { t: Words; store: Merchant }) {
  return (
    <List
      store={store}
      label={format(t.groceries.count, { count: t.groceries.list.length })}
      lines={t.groceries.list}
      columns={2}
    />
  );
}

function Party({ t, store }: { t: Words; store: Merchant }) {
  return <List store={store} label={t.party.label} lines={t.party.list} />;
}

/** Everything the garden bed takes, at the visitor's marketplace, and what each piece is for. */
function Parts({ t, store }: { t: Words; store: Merchant }) {
  return (
    <List
      store={store}
      label={format(t.research.count, { count: PARTS.length })}
      lines={PARTS.map((part) => t.research.parts[part])}
      notes={PARTS.map((part) => t.research.notes[part])}
    />
  );
}

/** A store's app icon (or logo), as a small tile. */
function StoreTile({
  store,
  small = false,
}: {
  store: Merchant;
  small?: boolean;
}) {
  return (
    <Image
      src={store.logo}
      alt=""
      width={36}
      height={36}
      unoptimized
      className={`flex-none object-contain ring-1 ring-black/5 ${small ? "size-6 rounded-[7px]" : "size-9 rounded-[11px]"}`}
    />
  );
}

/** When the bill in the screenshot is due, in the reader's language. */
function dueDate(tag: string) {
  return new Intl.DateTimeFormat(tag, {
    month: "short",
    day: "numeric",
  }).format(new Date(2026, 10, 9));
}
