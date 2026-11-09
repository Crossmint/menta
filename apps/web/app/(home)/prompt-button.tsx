"use client";

import { type ReactNode, useState } from "react";
import { SetupPrompt } from "../(app)/connect-agent";

/**
 * An assistant on the landing: until Menta is in every assistant's
 * marketplace, it opens the setup prompt to copy into that assistant.
 */
export function PromptButton({
  serverUrl,
  label,
  className,
  children,
}: {
  serverUrl: string;
  /** The accessible name, when the button shows only an icon. */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={`cursor-pointer ${className ?? ""}`}
      >
        {children}
      </button>
      {open ? (
        <SetupPrompt serverUrl={serverUrl} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
