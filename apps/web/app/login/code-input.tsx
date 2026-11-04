"use client";

import { useState } from "react";

export const CODE_LENGTH = 6;

/**
 * The sign-in code as one box per digit. It's a single input under the boxes,
 * so pasting the code, the keyboard's one-time-code suggestion and password
 * managers fill every box at once, and backspace walks back naturally.
 */
export function CodeInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (code: string) => void;
  label: string;
}) {
  const [focused, setFocused] = useState(false);
  /** The box the next digit goes in; the last one once all are filled. */
  const active = Math.min(value.length, CODE_LENGTH - 1);

  return (
    <div className="relative">
      <input
        id="credential"
        autoFocus
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        aria-label={label}
        maxLength={CODE_LENGTH}
        value={value}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
        }
        // The caret always sits after the last digit, where the active box is.
        onSelect={(event) => {
          const end = event.currentTarget.value.length;
          event.currentTarget.setSelectionRange(end, end);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 z-10 h-full w-full bg-transparent text-[16px] text-transparent caret-transparent outline-none selection:bg-transparent"
      />
      <div aria-hidden="true" className="grid grid-cols-6 gap-2 sm:gap-3">
        {Array.from({ length: CODE_LENGTH }, (_, index) => {
          const digit = value[index];
          const current = focused && index === active;
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: the boxes are fixed positions.
              key={index}
              className={`flex aspect-[5/6] items-center justify-center rounded-[14px] border bg-white text-[24px] font-medium tabular-nums transition-[border-color,box-shadow] ${
                current
                  ? "border-ink shadow-[0_0_0_3px_rgb(0_0_0/6%)]"
                  : "border-line-card"
              }`}
            >
              {digit ?? (current ? <span className="code-caret" /> : null)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
