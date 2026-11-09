"use client";

import { type RefObject, useEffect, useRef } from "react";
import type { DictationStatus } from "../../lib/client/dictation";
import { Check, Close, Mic } from "./icons";

/** Bar shapes for the level meter: taller in the middle, like a voice. */
const bars = [0.55, 0.85, 1, 0.75, 0.5];

/** A small live waveform driven by the microphone level, without re-rendering. */
function Meter({ level }: { level: RefObject<number> }) {
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    let frame = 0;
    let smooth = 0;
    let tick = 0;
    const draw = () => {
      const target = level.current ?? 0;
      smooth += (target - smooth) * (target > smooth ? 0.5 : 0.18);
      tick += 1;
      refs.current.forEach((bar, index) => {
        if (bar) {
          const wobble = 0.82 + 0.18 * Math.sin(tick / 4 + index * 1.7);
          const scale = 0.2 + 0.8 * Math.min(1, smooth * bars[index] * wobble);
          bar.style.transform = `scaleY(${scale.toFixed(3)})`;
        }
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [level]);
  return (
    <span aria-hidden="true" className="flex h-5 items-center gap-[2px]">
      {bars.map((weight, index) => (
        <span
          key={weight}
          ref={(element) => {
            refs.current[index] = element;
          }}
          className="h-5 w-[3px] origin-center rounded-full bg-ink"
          style={{ transform: "scaleY(0.2)" }}
        />
      ))}
    </span>
  );
}

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The composer's voice controls. They take the same width whether idle or
 * recording, so the text field never reflows when dictation starts or stops.
 */
export function DictationControls({
  status,
  elapsed,
  level,
  error,
  onDismissError,
  onStart,
  onStop,
  onCancel,
  disabled,
  children,
}: {
  status: DictationStatus;
  elapsed: number;
  level: RefObject<number>;
  error: string | null;
  onDismissError: () => void;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  disabled: boolean;
  /** The send button, shown when not dictating. */
  children: React.ReactNode;
}) {
  const active = status !== "idle";
  useEffect(() => {
    if (!error) {
      return;
    }
    const timer = setTimeout(onDismissError, 7000);
    return () => clearTimeout(timer);
  }, [error, onDismissError]);

  return (
    <div className="relative flex flex-none items-center justify-end gap-2.5 max-sm:w-[110px] sm:w-[146px]">
      {error ? (
        <div
          role="alert"
          className="pointer-events-none absolute right-0 bottom-full z-10 mb-3 w-max max-w-[min(320px,80vw)] animate-[fade-in_160ms_ease-out] rounded-[12px] bg-ink px-3.5 py-2.5 text-[13px] leading-snug text-white shadow-[0_1px_2px_rgb(0_0_0/8%),0_12px_32px_-8px_rgb(0_0_0/22%)]"
        >
          {error}
        </div>
      ) : null}
      <span role="status" className="sr-only">
        {status === "listening"
          ? "Listening. Press Enter to finish or Escape to cancel."
          : ""}
      </span>
      {active ? (
        <>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel dictation"
            title="Cancel (Esc)"
            className="tap relative -mr-1.5 inline-flex size-8 flex-none items-center justify-center rounded-full text-muted transition-colors hover:bg-black/[0.04] hover:text-ink"
          >
            <Close />
          </button>
          <span className="flex items-center gap-1.5 animate-[fade-in_200ms_ease-out]">
            <Meter level={level} />
            <span
              role="timer"
              aria-label={`${elapsed} seconds`}
              className="w-[30px] font-mono text-xs text-soft tabular-nums max-sm:hidden"
            >
              {clock(elapsed)}
            </span>
          </span>
          <button
            type="button"
            onClick={onStop}
            disabled={status === "finishing"}
            aria-label="Finish dictation"
            title="Finish (Enter)"
            className="raised tap relative inline-flex size-10 flex-none items-center justify-center rounded-full bg-ink text-white hover:bg-ink-hover"
          >
            {status === "finishing" ? (
              <span
                className="spinner"
                style={{
                  borderColor: "rgb(255 255 255 / 30%)",
                  borderTopColor: "#fff",
                }}
              />
            ) : (
              <Check />
            )}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onStart}
            disabled={disabled}
            aria-label="Dictate"
            title="Dictate"
            className="tap relative inline-flex size-10 flex-none items-center justify-center rounded-full text-soft transition-colors hover:bg-black/[0.04] hover:text-ink disabled:opacity-30"
          >
            <Mic />
          </button>
          {children}
        </>
      )}
    </div>
  );
}
