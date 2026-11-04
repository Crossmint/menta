"use client";

import { AssistantMark } from "./assistant-mark";
import { Mascot } from "./icons";

/** Official app icons (public/assistants) for agents we know by name. */
export const AGENT_ICONS = [
  { match: /grok|xai/i, src: "/assistants/grokbot.png" },
  { match: /chatgpt|openai|codex/i, src: "/assistants/chatgpt.png" },
  { match: /claude|anthropic/i, src: "/assistants/claude.png" },
  { match: /\bmuse\b/i, src: "/assistants/muse.png" },
] as const;

/**
 * An agent's icon, a rounded square like every app icon in Menta: its
 * official app icon when we know it, Menta's leaf for Menta's own chat, else
 * its mark (the logo it registered, or its initials). `className` sizes it.
 */
export function AgentIcon({
  name,
  logoUrl,
  className = "size-9 rounded-[10px] text-[11px]",
}: {
  name: string;
  logoUrl?: string | null;
  className?: string;
}) {
  const known = AGENT_ICONS.find(({ match }) => match.test(name));
  return (
    <span
      aria-hidden="true"
      className={`inline-flex flex-none items-center justify-center overflow-hidden bg-white ring-1 ring-black/[0.06] ${className}`}
    >
      {known ? (
        // biome-ignore lint/performance/noImgElement: a fixed local app icon at its natural size
        <img src={known.src} alt="" className="size-full object-cover" />
      ) : /\bmenta\b/i.test(name) ? (
        <span className="size-full [&_img]:size-full">
          <Mascot />
        </span>
      ) : (
        <AssistantMark name={name} logoUrl={logoUrl} className="size-full" />
      )}
    </span>
  );
}
