import { colors, mascot } from "../../lib/brand";
import { brandImage } from "../../lib/brand-image";
import { loadMessages } from "../../lib/i18n/messages";
import {
  assistantIcon,
  dollars,
  Lock,
  social,
  socialImage,
  storeIcon,
  TileFace,
} from "../_components/social-image";

/*
 * The link images for the signed-in pages Menta's MCP server links to. Link
 * crawlers fetch those pages signed out and land on sign-in, so sign-in's
 * metadata points at these (login/preview.ts), served at /social/<page>.
 */

/** The request page's ask, beside a limit's amount and the stores it pays. */
async function SpendingLimitImage() {
  const t = (await loadMessages("en")).checkout.limit;
  const [amazon, instacart] = await Promise.all([
    storeIcon("amazon"),
    storeIcon("instacart"),
  ]);
  return socialImage({
    title: t.title,
    accent: "spending limit",
    tiles: [
      <TileFace key="amount" background={social.green} color={colors.white}>
        <span
          style={{ fontSize: 54, fontWeight: 700, letterSpacing: "-0.04em" }}
        >
          {dollars(150)}
        </span>
      </TileFace>,
      amazon,
      instacart,
    ],
  });
}

function Dots({ count, size }: { count: number; size: number }) {
  return (
    <div style={{ display: "flex", gap: size * 0.6 }}>
      {Array.from({ length: count }, (_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: the masked characters
          key={index}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.ink,
          }}
        />
      ))}
    </div>
  );
}

/**
 * The secure page's private step: a lock and a masked field beside the
 * headline, with a store people sign in to. Generic: never the item, store
 * or who it's for.
 */
async function SecurePageImage() {
  const t = (await loadMessages("en")).checkout.preview;
  const amazon = await storeIcon("amazon");
  return socialImage({
    title: t.shareTitle,
    accent: "securely",
    tiles: [
      <TileFace key="lock" background={social.green}>
        <Lock size={84} color={colors.white} />
      </TileFace>,
      <TileFace key="dots">
        <Dots count={3} size={22} />
      </TileFace>,
      amazon,
    ],
  });
}

/** The wallet's first step, saving a card, beside a card, a lock and a store it pays. */
async function WalletImage() {
  const m = await loadMessages("en");
  const [starbucks, leaf] = await Promise.all([
    storeIcon("starbucks"),
    brandImage(mascot),
  ]);
  return socialImage({
    title: m.app.home.addCard,
    accent: "card",
    tiles: [
      <TileFace
        key="card"
        background="linear-gradient(135deg, #1f3d2a, #0a0a0a 70%)"
        color={colors.white}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: 22,
          }}
        >
          {/* biome-ignore lint/performance/noImgElement: ImageResponse draws plain img, not next/image. */}
          <img
            src={leaf}
            width={48}
            height={48}
            style={{ borderRadius: 11 }}
            alt=""
          />
          <span style={{ fontFamily: "Geist Mono", fontSize: 32 }}>4242</span>
        </div>
      </TileFace>,
      <TileFace key="lock" background={social.green}>
        <Lock size={72} color={colors.white} />
      </TileFace>,
      starbucks,
    ],
  });
}

function Glyph({ d, color }: { d: string; color: string }) {
  return (
    <svg
      aria-hidden="true"
      width="76"
      height="76"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const PIN =
  "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z";
const BELL =
  "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0";

/**
 * Settings beside its sections' symbols: addresses (the MCP's address link
 * lands here), the agents people connect and notifications.
 */
async function SettingsImage() {
  const p = (await loadMessages("en")).app.settingsPage;
  const chatgpt = await assistantIcon("chatgpt");
  return socialImage({
    title: p.title,
    tiles: [
      <TileFace key="pin" background={social.green}>
        <Glyph d={PIN} color={colors.white} />
      </TileFace>,
      chatgpt,
      <TileFace key="bell">
        <Glyph d={BELL} color={colors.ink} />
      </TileFace>,
    ],
  });
}

/** Each image, by the name in its URL, with the words a screen reader gets. */
export const SOCIAL_PAGES = {
  "spending-limit": {
    image: SpendingLimitImage,
    alt: "Menta: set up a spending limit. Your assistant spends only what you approve.",
  },
  "secure-page": {
    image: SecurePageImage,
    alt: "Menta: sign in securely. Passwords and codes go straight to the store; your assistant never sees them.",
  },
  wallet: {
    image: WalletImage,
    alt: "Menta: save a card. It stays with Crossmint; your assistant never sees it.",
  },
  settings: {
    image: SettingsImage,
    alt: "Menta settings: delivery addresses, agents and notifications.",
  },
} as const;

export type SocialPage = keyof typeof SOCIAL_PAGES;
