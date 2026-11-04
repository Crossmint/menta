"use client";

import { type ReactNode, useEffect, useState } from "react";

/**
 * Eases its content open and closed (height and opacity), keeping it mounted
 * until it has closed. `appear` also eases it in on first render.
 */
export function Collapse({
  open,
  appear = false,
  children,
}: {
  open: boolean;
  appear?: boolean;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open && !appear);
  useEffect(() => {
    if (open) {
      setMounted(true);
      // Paint the closed state first so the change animates.
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    setShown(false);
    // No transition runs with reduced motion, so nothing would unmount it.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMounted(false);
    }
  }, [open]);
  if (!mounted) {
    return null;
  }
  return (
    <div
      inert={!open}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && !open) {
          setMounted(false);
        }
      }}
      className={`grid transition-[grid-template-rows,opacity] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${shown ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
