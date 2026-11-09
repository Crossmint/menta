import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import {
  colors,
  MASCOT_RADIUS,
  mascot,
  WORDMARK_GAP,
  WORDMARK_SCALE,
  wordmark,
} from "../../lib/brand";
import { brandImage } from "../../lib/brand-image";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fontDir = join(process.cwd(), "node_modules/geist/dist/fonts");

export const social = {
  faint: "#a1a1aa",
  green: "linear-gradient(135deg, #3dd64f, #10b45e)",
} as const;

/** A sample amount in whole dollars, like a limit someone sets ("$150"). */
export function dollars(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Geist, as the homepage sets it, for ImageResponse. */
export async function socialFonts() {
  const [regular, bold, mono] = await Promise.all(
    [
      "geist-sans/Geist-Regular.ttf",
      "geist-sans/Geist-Bold.ttf",
      "geist-mono/GeistMono-Regular.ttf",
    ].map((file) => readFile(join(fontDir, file))),
  );
  return [
    { name: "Geist", data: regular, weight: 400, style: "normal" },
    { name: "Geist", data: bold, weight: 700, style: "normal" },
    { name: "Geist Mono", data: mono, weight: 400, style: "normal" },
  ] as const;
}

/** The leaf tile and the "menta" wordmark, at the tile's side. */
export async function SocialLogo({ side }: { side: number }) {
  const [mascotSrc, wordmarkSrc] = await Promise.all([
    brandImage(mascot),
    brandImage(wordmark),
  ]);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: Math.round(side * WORDMARK_GAP),
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: ImageResponse draws plain img, not next/image. */}
      <img
        src={mascotSrc}
        width={side}
        height={side}
        style={{ borderRadius: side * MASCOT_RADIUS }}
        alt=""
      />
      {/* biome-ignore lint/performance/noImgElement: ImageResponse draws plain img, not next/image. */}
      <img
        src={wordmarkSrc}
        width={Math.round(
          (side * WORDMARK_SCALE * wordmark.width) / wordmark.height,
        )}
        height={Math.round(side * WORDMARK_SCALE)}
        alt=""
      />
    </div>
  );
}

/** A headline word by word so it wraps, centered, with the words of `accent` in the leaf's green. */
function Headline({
  title,
  accent,
  width,
}: {
  title: string;
  accent?: string;
  width: number;
}) {
  const at = accent ? title.indexOf(accent) : -1;
  const parts =
    accent && at >= 0
      ? [
          { text: title.slice(0, at), accent: false },
          { text: accent, accent: true },
          { text: title.slice(at + accent.length), accent: false },
        ]
      : [{ text: title, accent: false }];
  const words = parts.flatMap((part) =>
    part.text
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((word) => ({ word, accent: part.accent })),
  );
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        columnGap: 22,
        maxWidth: width,
        fontSize: 92,
        fontWeight: 700,
        letterSpacing: "-0.05em",
        lineHeight: 1.02,
      }}
    >
      {words.map(({ word, accent }, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: the headline's words, in order
          key={index}
          style={
            accent
              ? {
                  backgroundImage: social.green,
                  backgroundClip: "text",
                  color: "transparent",
                }
              : {}
          }
        >
          {word}
        </span>
      ))}
    </div>
  );
}

/** A store's app icon (public/merchants), for a tile. */
export async function storeIcon(id: string) {
  const src = await brandImage({ src: `/merchants/${id}.png` });
  return <SocialIcon src={src} />;
}

/** An assistant's app icon (public/assistants), for a tile. */
export async function assistantIcon(id: string) {
  const src = await brandImage({ src: `/assistants/${id}.png` });
  return <SocialIcon src={src} />;
}

function SocialIcon({ src }: { src: string }) {
  // A touch larger than the tile, so the icon's own edge never shows as a rim.
  return (
    // biome-ignore lint/performance/noImgElement: ImageResponse draws plain img, not next/image.
    <img
      src={src}
      width="108%"
      height="108%"
      style={{ margin: "-4%", maxWidth: "none" }}
      alt=""
    />
  );
}

/** A tile's face that isn't a store: a symbol or a few words on a color. */
export function TileFace({
  background = colors.white,
  color = colors.ink,
  children,
}: {
  background?: string;
  color?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        ...(background.startsWith("linear")
          ? { backgroundImage: background }
          : { backgroundColor: background }),
        color,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Where the three tiles float, up in the top right like the hero's stores:
 * centers on the 1200×630 card, side and tilt. The first shows whole, so it
 * carries the page's symbol; the other two run off the card's edges.
 */
const PLACEMENTS = [
  { x: 860, y: 150, side: 190, tilt: -12 },
  { x: 1075, y: 55, side: 180, tilt: 12 },
  { x: 1170, y: 300, side: 160, tilt: -10 },
] as const;

function Tile({
  x,
  y,
  side,
  tilt,
  children,
}: {
  x: number;
  y: number;
  side: number;
  tilt: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        left: x - side / 2,
        top: y - side / 2,
        width: side,
        height: side,
        overflow: "hidden",
        borderRadius: side * 0.22,
        transform: `rotate(${tilt}deg)`,
        boxShadow: "0 20px 40px -16px rgba(0,0,0,0.45)",
      }}
    >
      {children}
    </div>
  );
}

export function Lock({
  size: side = 16,
  color = social.faint as string,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      width={side}
      height={side}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/**
 * The social card for a Menta link, in the homepage hero's look and made to
 * read in a small message bubble: the logo top left, a big headline across
 * the bottom (`accent` in green), and three tilted tiles floating off the top
 * right like the hero's stores. English, from the pages' own words. Generic
 * on purpose: crawlers fetch these with no session, so nothing in them is a
 * user's.
 */
export async function socialImage({
  title,
  accent,
  width = 1000,
  tiles,
}: {
  title: string;
  accent?: string;
  /** The headline's widest line, so it breaks where it reads best. */
  width?: number;
  tiles: readonly ReactNode[];
}) {
  const [fonts, logo] = await Promise.all([
    socialFonts(),
    SocialLogo({ side: 46 }),
  ]);
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        padding: "0 72px 60px",
        fontFamily: "Geist",
        color: colors.ink,
        backgroundColor: colors.stage,
        backgroundImage:
          "radial-gradient(circle at 85% 20%, rgba(255,255,255,1), rgba(255,255,255,0) 50%)",
      }}
    >
      {PLACEMENTS.map((placement, index) => (
        <Tile key={`${placement.x}-${placement.y}`} {...placement}>
          {tiles[index]}
        </Tile>
      ))}
      <div style={{ display: "flex", position: "absolute", top: 56, left: 72 }}>
        {logo}
      </div>
      <Headline title={title} accent={accent} width={width} />
    </div>,
    { ...size, fonts: [...fonts] },
  );
}
