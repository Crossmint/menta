import Image from "next/image";
import NextLink from "next/link";
import type { SVGProps } from "react";
import {
  BRAND_NAME,
  MASCOT_RADIUS,
  mascot,
  WORDMARK_GAP,
  WORDMARK_SCALE,
  wordmark,
} from "../../lib/brand";

/** The checkout UI's icons, shared with the ChatGPT/Claude card. */
export {
  Check,
  Chevron,
  Close,
  Eye,
  Lock,
  Pin,
  Shield,
} from "@oca/agent/ui";

function Icon({
  size = 16,
  strokeWidth = 1.75,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export const Plus = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const ArrowUp = (p: SVGProps<SVGSVGElement>) => (
  <Icon strokeWidth={2} {...p}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </Icon>
);
export const Stop = (p: SVGProps<SVGSVGElement>) => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" {...p}>
    <rect width="12" height="12" rx="2.5" fill="currentColor" />
  </svg>
);
export const Mic = (p: SVGProps<SVGSVGElement>) => (
  <Icon size={18} {...p}>
    <rect x="9" y="3" width="6" height="11.5" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </Icon>
);
export const Camera = (p: SVGProps<SVGSVGElement>) => (
  <Icon size={18} {...p}>
    <path d="M4.5 7.5h3l1.6-2.3a1 1 0 0 1 .8-.4h4.2a1 1 0 0 1 .8.4l1.6 2.3h3a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V9a1.5 1.5 0 0 1 1.5-1.5Z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
);
export const Trash = (p: SVGProps<SVGSVGElement>) => (
  <Icon size={15} {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12a2 2 0 0 0 2 1.8h7a2 2 0 0 0 2-1.8l1-12M9 7V4.8a.8.8 0 0 1 .8-.8h4.4a.8.8 0 0 1 .8.8V7" />
  </Icon>
);
export const Card = (p: SVGProps<SVGSVGElement>) => (
  <Icon strokeWidth={2} {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 10h18" />
  </Icon>
);
export const Link = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Icon>
);
export const Menu = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 9h16M4 15h10" />
  </Icon>
);
export const Copy = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
    <path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
  </Icon>
);
export const Bag = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M5.5 8h13l-1 12h-11z" />
    <path d="M9 10V7a3 3 0 0 1 6 0v3" />
  </Icon>
);
export const Clock = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);
export const Receipt = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M6 3.5h12v17l-2.5-1.5-2 1.5-1.5-1.5-1.5 1.5-2-1.5L6 20.5z" />
    <path d="M9.5 8.5h5M9.5 12h5" />
  </Icon>
);
export const Person = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="8.5" r="3.75" />
    <path d="M4.75 20c1-3.75 3.75-5.6 7.25-5.6s6.25 1.85 7.25 5.6" />
  </Icon>
);
export const Alert = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 4v10M12 19.5v.5" />
  </Icon>
);

/** The alert in a ring, for a page-sized outcome where a bare "!" reads too thin. */
export const Warning = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5v.5" />
  </Icon>
);

export const Sparkle = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z" />
    <path d="M18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" />
  </Icon>
);
export const Bell = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M6 9.5a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4s2-1.5 2-6.5" />
    <path d="M10 19.5a2.2 2.2 0 0 0 4 0" />
  </Icon>
);
export const Monitor = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3" y="4.5" width="18" height="12" rx="2" />
    <path d="M8.5 20h7M12 16.5V20" />
  </Icon>
);
export const Store = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 9.5 5.5 4.5h13L20 9.5" />
    <path d="M4 9.5c0 1.4 1.1 2.5 2.7 2.5s2.6-1.1 2.6-2.5c0 1.4 1.1 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1 2.5 2.6 2.5S20 10.9 20 9.5" />
    <path d="M5.5 12v7.5h13V12" />
  </Icon>
);
export const Search = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.4-4.4" />
  </Icon>
);
export const Plug = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M9 7V3M15 7V3M6 7h12v4a6 6 0 0 1-12 0V7zM12 17v4" />
  </Icon>
);
export const Gear = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Icon>
);
export const Bubble = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12z" />
  </Icon>
);
/** Translate (Lucide "languages", ISC): a character and a letter. */
export const Translate = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" />
  </Icon>
);
export const Globe = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.75 5.6 3.75 9S14.5 18.4 12 21c-2.5-2.6-3.75-5.6-3.75-9S9.5 5.6 12 3z" />
  </Icon>
);

export const Pencil = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M14.5 5.5l4 4M4.5 19.5l1-4.5L16 4.5a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L9 18.5z" />
  </Icon>
);
export const Star = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />
  </Icon>
);
/** A dial at part-way: a spending limit. */
export const Gauge = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4.5 17a8 8 0 1 1 15 0" />
    <path d="m12 13 3.5-3.5" />
    <circle cx="12" cy="13" r="1" />
  </Icon>
);
export const House = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 10.5 12 4l8 6.5V20h-5.5v-6h-5v6H4z" />
  </Icon>
);
export const Wallet = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17v2.5" />
    <rect x="4" y="7.5" width="16" height="12" rx="2.5" />
    <path d="M16 13.5h.5" strokeWidth={2.5} />
  </Icon>
);
export const Mail = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="m4 7 8 6 8-6" />
  </Icon>
);
/** A life ring: support. */
export const Support = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="m6 6 3.5 3.5M14.5 14.5 18 18M18 6l-3.5 3.5M9.5 14.5 6 18" />
  </Icon>
);
export const Help = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.75 9.5a2.4 2.4 0 0 1 4.6.9c0 1.6-2.35 2-2.35 3.6M12 16.5v.5" />
  </Icon>
);
export const Doc = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M6 3.5h8l4 4v13H6z" />
    <path d="M9.5 12h5M9.5 15.5h5" />
  </Icon>
);
export const LogOut = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" />
    <path d="M14.5 8 19 12l-4.5 4M19 12H9.5" />
  </Icon>
);
export const ArrowLeft = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
);
/** An external link's arrow. */
export const ArrowOut = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M7.5 16.5l9-9M9 7.5h7.5V15" />
  </Icon>
);

/**
 * The Menta icon: the leaf in a rounded tile (lib/brand.ts). `size` is its
 * side. Logos sit near the top of every page, so they load eagerly.
 */
export function Mascot({ size = 24 }: { size?: number }) {
  return (
    <Image
      src={mascot.src}
      alt=""
      width={size}
      height={size}
      loading="eager"
      className="shrink-0"
      style={{ borderRadius: `${MASCOT_RADIUS * 100}%` }}
    />
  );
}

/** The logo: the icon with the "menta" wordmark beside it, as in the lockup. `size` is the icon's side. */
export function Logo({ size = 21 }: { size?: number }) {
  const height = Math.round(size * WORDMARK_SCALE);
  return (
    <span
      role="img"
      aria-label={BRAND_NAME}
      className="inline-flex shrink-0 items-center"
      style={{ gap: Math.round(size * WORDMARK_GAP) }}
    >
      <Mascot size={size} />
      <Image
        src={wordmark.src}
        alt=""
        width={Math.round((height * wordmark.width) / wordmark.height)}
        height={height}
        loading="eager"
      />
    </span>
  );
}

/** The logo at the size of the text around it, for headings that name Menta. */
export function InlineLogo() {
  return (
    <span
      role="img"
      aria-label={BRAND_NAME}
      className="inline-flex items-center gap-[0.14em] align-[-0.08em]"
    >
      <Image
        src={mascot.src}
        alt=""
        width={mascot.width}
        height={mascot.height}
        className="h-[0.72em] w-auto"
        style={{ borderRadius: `${MASCOT_RADIUS * 100}%` }}
      />
      <Image
        src={wordmark.src}
        alt=""
        width={wordmark.width}
        height={wordmark.height}
        className="h-[0.68em] w-auto"
      />
    </span>
  );
}

/** The logo, linking home (`/`), or to `href` (the sidebar's goes to a new chat). */
export function Brand({ href = "/" }: { href?: string }) {
  return (
    <NextLink href={href} className="inline-flex">
      <Logo />
    </NextLink>
  );
}
