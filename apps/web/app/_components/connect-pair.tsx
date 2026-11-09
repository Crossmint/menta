"use client";

import Image from "next/image";
import type { Assistant } from "../../lib/server/assistant";
import { AssistantMark } from "./assistant-mark";

/**
 * Connecting an assistant: its app icon, a dashed line and Menta's, as square
 * tiles like the assistants on the homepage. The official icon when we have
 * one, else its registered logo or initials in the same tile. Decorative: the
 * page says who is connecting in words.
 */
export function ConnectPair({
  assistant,
  large = false,
}: {
  assistant: Assistant;
  /** The consent page's size; sign-in uses the smaller one. */
  large?: boolean;
}) {
  const tile = `${large ? "size-14" : "size-12"} flex-none overflow-hidden rounded-[27%] bg-white ring-1 ring-black/10 shadow-[0_8px_24px_rgb(0_0_0/6%)]`;
  const px = large ? 56 : 48;
  return (
    <div aria-hidden="true" className="flex items-center gap-3">
      <span className={tile}>
        {assistant.icon ? (
          <Image
            src={assistant.icon}
            alt=""
            width={px}
            height={px}
            unoptimized
            className="size-full object-cover"
          />
        ) : (
          <AssistantMark
            name={assistant.name}
            logoUrl={assistant.logoUrl}
            className="size-full text-xs [&_svg]:size-6"
          />
        )}
      </span>
      <span
        className={`${large ? "w-12" : "w-10"} border-t-[1.5px] border-dashed border-[#C4C4C8]`}
      />
      <Image
        src="/icon/192"
        alt=""
        width={px}
        height={px}
        unoptimized
        className={tile}
      />
    </div>
  );
}
