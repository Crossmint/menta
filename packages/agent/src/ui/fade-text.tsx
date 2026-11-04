"use client";

import { useEffect, useState } from "react";

/**
 * One line of text that crossfades when it changes: the old line fades out
 * in the same spot as the new one fades in, so nothing moves or resizes.
 * `className` (which may carry its own animation, like the working shimmer)
 * goes on an inner span, so it never replaces the fade; a timer clears the old
 * line even if its animation end never arrives.
 */
export function FadeText({
  text,
  className,
}: {
  text: string;
  className: string;
}) {
  const [shown, setShown] = useState({
    text,
    previous: null as string | null,
    key: 0,
  });
  if (shown.text !== text) {
    setShown({ text, previous: shown.text, key: shown.key + 1 });
  }
  const { key, previous } = shown;
  useEffect(() => {
    if (previous === null) {
      return;
    }
    const timer = window.setTimeout(
      () =>
        setShown((current) =>
          current.key === key ? { ...current, previous: null } : current,
        ),
      360,
    );
    return () => window.clearTimeout(timer);
  }, [key, previous]);
  return (
    <span className="grid min-w-0 flex-1">
      {previous !== null ? (
        <span
          key={`was-${key}`}
          aria-hidden="true"
          className="min-w-0 animate-[fade-out_320ms_ease-out_forwards] truncate [grid-area:1/1] motion-reduce:hidden"
        >
          <span className={className}>{previous}</span>
        </span>
      ) : null}
      <span
        key={key}
        className="min-w-0 animate-[fade-in_320ms_ease-out] truncate [grid-area:1/1] motion-reduce:animate-none"
      >
        <span className={className}>{shown.text}</span>
      </span>
    </span>
  );
}
