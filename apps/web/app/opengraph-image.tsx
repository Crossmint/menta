import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import {
  colors,
  MASCOT_RADIUS,
  mascot,
  WORDMARK_GAP,
  WORDMARK_SCALE,
  wordmark,
} from "../lib/brand";
import { brandImage } from "../lib/brand-image";
import { loadMessages } from "../lib/i18n/messages";
import { CrossmintLogo } from "./_components/brand-marks";
import { ASSISTANTS, OTHER_ASSISTANTS } from "./(home)/assistants";
import { localPrice } from "./(home)/currency";

export const alt =
  "Menta by Crossmint: let your AI agent buy anything, anywhere. Works with ChatGPT, Claude, Grok and more.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fonts = join(process.cwd(), "node_modules/geist/dist/fonts");
const muted = "#737373";
const faint = "#a1a1aa";
const line = "#e7e7e9";
const green = "linear-gradient(135deg, #3dd64f, #10b45e)";

/** The hero's first order: the ask, and the receipt Menta comes back with. */
const ORDER = { store: "/stores/amazon.svg", name: "Amazon", usd: 79.99 };

/**
 * The social card: the homepage's hero in one frame. The headline with its
 * green words, the assistants it works with, and an order's receipt. English,
 * from the homepage's own words, so it changes when they do.
 */
export default async function OpenGraphImage() {
  const t = (await loadMessages("en")).landing;
  const icons = [...ASSISTANTS.map(({ icon }) => icon), ...OTHER_ASSISTANTS];
  const [bold, medium, regular, light, mono, mascotSrc, wordmarkSrc, store] =
    await Promise.all([
      readFile(join(fonts, "geist-sans/Geist-Bold.ttf")),
      readFile(join(fonts, "geist-sans/Geist-Medium.ttf")),
      readFile(join(fonts, "geist-sans/Geist-Regular.ttf")),
      readFile(join(fonts, "geist-sans/Geist-Light.ttf")),
      readFile(join(fonts, "geist-mono/GeistMono-Regular.ttf")),
      brandImage(mascot),
      brandImage(wordmark),
      brandImage({ src: ORDER.store }),
    ]);
  const assistants = await Promise.all(
    icons.map((icon) => brandImage({ src: `/assistants/${icon}.png` })),
  );

  // The headline, word by word so it wraps, with the accent words in green.
  const [before = "", after = ""] = t.hero.title.split("{accent}");
  const words = [
    ...before
      .trim()
      .split(" ")
      .map((word) => ({ word, accent: false })),
    ...t.hero.titleAccent.split(" ").map((word) => ({ word, accent: true })),
  ];
  const [crossmintBefore = ""] = t.demo.poweredBy.split("{crossmint}");
  const [builtBefore = ""] = t.hero.eyebrow.split("{crossmint}");
  const ask = t.demo.orders[0];
  const logo = 44;

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        padding: "64px 72px",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: "Geist",
        color: colors.ink,
        backgroundColor: colors.stage,
        backgroundImage:
          "radial-gradient(circle at 78% 40%, rgba(255,255,255,0.75), rgba(255,255,255,0) 55%)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height: "100%",
          width: 560,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: Math.round(logo * WORDMARK_GAP),
          }}
        >
          {/* biome-ignore lint/performance/noImgElement: ImageResponse draws plain img, not next/image. */}
          <img
            src={mascotSrc}
            width={logo}
            height={logo}
            style={{ borderRadius: logo * MASCOT_RADIUS }}
            alt=""
          />
          {/* biome-ignore lint/performance/noImgElement: ImageResponse draws plain img, not next/image. */}
          <img
            src={wordmarkSrc}
            width={Math.round(
              (logo * WORDMARK_SCALE * wordmark.width) / wordmark.height,
            )}
            height={Math.round(logo * WORDMARK_SCALE)}
            alt=""
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              columnGap: 13,
              fontSize: 66,
              fontWeight: 700,
              letterSpacing: "-0.05em",
              lineHeight: 1.04,
            }}
          >
            {words.map(({ word, accent }, index) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: the headline's words, in order
                key={index}
                style={{ display: "flex" }}
              >
                <span
                  style={
                    accent
                      ? {
                          backgroundImage: green,
                          backgroundClip: "text",
                          color: "transparent",
                        }
                      : {}
                  }
                >
                  {word}
                </span>
                {index === words.length - 1 ? (
                  <span style={{ marginLeft: -4 }}>{after}</span>
                ) : null}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 22, color: muted }}>
              {t.hero.worksWith}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              {assistants.map((src, index) => (
                // biome-ignore lint/performance/noImgElement: ImageResponse draws plain img, not next/image.
                <img
                  key={icons[index]}
                  src={src}
                  width={38}
                  height={38}
                  style={{
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                  alt=""
                />
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 20,
            color: muted,
          }}
        >
          {builtBefore.trim()}
          <CrossmintLogo
            width={112}
            height={21}
            style={{ color: colors.ink }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          width: 440,
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div
            style={{
              display: "flex",
              maxWidth: 360,
              padding: "16px 22px",
              borderRadius: "26px 26px 8px 26px",
              backgroundColor: "#ffffff",
              fontSize: 20,
              lineHeight: 1.35,
            }}
          >
            {ask?.ask}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            padding: 28,
            borderRadius: 30,
            backgroundColor: "#ffffff",
            border: `1px solid ${line}`,
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.05), 0 24px 48px -24px rgba(16,80,40,0.35)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                display: "flex",
                width: 30,
                height: 30,
                borderRadius: 15,
                alignItems: "center",
                justifyContent: "center",
                backgroundImage: green,
              }}
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span style={{ fontSize: 22, fontWeight: 500 }}>
              {t.demo.placed}
            </span>
            <span
              style={{
                marginLeft: "auto",
                padding: "3px 10px",
                borderRadius: 999,
                border: `1px solid ${line}`,
                fontFamily: "Geist Mono",
                fontSize: 14,
                color: muted,
              }}
            >
              USD
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                display: "flex",
                width: 64,
                height: 64,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${line}`,
              }}
            >
              {/* biome-ignore lint/performance/noImgElement: ImageResponse draws plain img, not next/image. */}
              <img src={store} width={34} height={34} alt="" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 24, fontWeight: 500 }}>
                {ORDER.name}
              </span>
              <span style={{ fontSize: 18, color: muted }}>{ask?.item}</span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              paddingTop: 20,
              borderTop: "2px dashed #dcdce0",
            }}
          >
            <span
              style={{
                fontFamily: "Geist Mono",
                fontSize: 15,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: faint,
              }}
            >
              {t.demo.total}
            </span>
            <span
              style={{
                fontSize: 46,
                fontWeight: 300,
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              {localPrice("en", ORDER.usd)}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingTop: 18,
              borderTop: "2px dashed #dcdce0",
              fontSize: 16,
              color: muted,
            }}
          >
            <svg
              aria-hidden="true"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke={faint}
              strokeWidth="2"
            >
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            {`${t.demo.card} · ${crossmintBefore.trim()}`}
            <CrossmintLogo
              width={80}
              height={15}
              style={{ color: colors.ink }}
            />
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Geist", data: light, weight: 300, style: "normal" },
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: medium, weight: 500, style: "normal" },
        { name: "Geist", data: bold, weight: 700, style: "normal" },
        { name: "Geist Mono", data: mono, weight: 400, style: "normal" },
      ],
    },
  );
}
