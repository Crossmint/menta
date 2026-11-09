"use client";

import { useState } from "react";
import { ClaudeMark, CursorMark, GrokMark, OpenAIMark } from "./brand-marks";
import { Sparkle } from "./icons";

/** Our official mark for an assistant we know by name, or null. */
function knownMark(name: string) {
  if (/chatgpt|openai|codex/i.test(name)) {
    return <OpenAIMark />;
  }
  if (/claude|anthropic/i.test(name)) {
    return <ClaudeMark />;
  }
  if (/grok|xai/i.test(name)) {
    return <GrokMark />;
  }
  if (/cursor/i.test(name)) {
    return <CursorMark />;
  }
  return null;
}

function initials(name: string) {
  return name
    .replace(/[^\p{L}\p{N}]/gu, "")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * A connected assistant's logo: our mark for the ones we know (ChatGPT, Codex,
 * Claude, Grok, Cursor), else the logo it registered with Stytch, else its
 * initials, else (no name) a sparkle.
 * A rounded square, like every app icon in Menta; `className` sizes and frames it.
 */
export function AssistantMark({
  name,
  logoUrl,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  className: string;
}) {
  const [broken, setBroken] = useState(false);
  const known = knownMark(name);
  const logo =
    !known && !broken && logoUrl?.startsWith("https://") ? logoUrl : null;
  return (
    <span
      className={`inline-flex flex-none items-center justify-center overflow-hidden rounded-[28%] font-semibold tracking-[-0.02em] text-ink ${className}`}
    >
      {known ??
        (logo ? (
          // biome-ignore lint/performance/noImgElement: a remote logo the assistant registered; next/image needs every host configured
          <img
            src={logo}
            alt=""
            className="size-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="text-soft">
            {/* An assistant we can't name: a sparkle, not a "?". */}
            {initials(name) || <Sparkle width={20} height={20} />}
          </span>
        ))}
    </span>
  );
}
