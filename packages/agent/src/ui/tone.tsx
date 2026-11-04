import type { Tone } from "./status.js";

export type { Tone };

export const toneText: Record<Tone, string> = {
  idle: "text-quiet",
  working: "text-accent",
  attention: "text-attention-ink",
  success: "text-success",
  danger: "text-danger",
  muted: "text-quiet",
};

const dotStyle: Record<Tone, string> = {
  idle: "border-[1.5px] border-faint",
  working: "pulse bg-accent shadow-[0_0_0_4px_var(--color-accent-soft)]",
  attention: "bg-attention shadow-[0_0_0_4px_var(--color-attention-soft)]",
  success: "bg-success shadow-[0_0_0_4px_var(--color-success-soft)]",
  danger: "bg-danger shadow-[0_0_0_4px_var(--color-danger-soft)]",
  muted: "bg-faint",
};

export function Dot({ tone }: { tone: Tone }) {
  return (
    <span className={`size-[7px] flex-none rounded-full ${dotStyle[tone]}`} />
  );
}

export function StatusDot({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`label inline-flex items-center gap-2 ${toneText[tone]}`}>
      <Dot tone={tone} />
      {label}
    </span>
  );
}
