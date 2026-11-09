/**
 * An on/off switch: a button with `role="switch"`, the landing's Menta green
 * when on. While `busy` (saving), it ignores clicks without dimming, so a flip
 * doesn't flicker; a disabled switch dims only while off (an on one that can't
 * be turned off, like the default card, stays green).
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  busy,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      aria-busy={busy || undefined}
      onClick={() => {
        if (!busy) {
          onChange(!checked);
        }
      }}
      className="tap group relative inline-flex h-6 w-10 flex-none items-center rounded-full bg-line-strong p-0.5 transition-colors duration-150 aria-checked:bg-[#10b45e] motion-reduce:transition-none [&:disabled:not([aria-checked=true])]:opacity-50"
    >
      <span className="size-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-aria-checked:translate-x-4 motion-reduce:transition-none" />
    </button>
  );
}
