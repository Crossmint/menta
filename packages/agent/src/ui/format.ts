import { EN, type Ui } from "./i18n/index.js";

/** Money as the user reads it: "$31.50", or "31.50 XYZ" for an unknown currency. */
export function money(
  {
    amount,
    currency,
  }: {
    readonly amount: string;
    readonly currency: string;
  },
  ui: Ui = EN,
) {
  try {
    return new Intl.NumberFormat(ui.tag, {
      style: "currency",
      currency,
    }).format(Number(amount));
  } catch {
    return `${amount} ${currency}`;
  }
}

/** A time today ("3:42 PM"), or a date ("Oct 7"), in `tag`'s language (the device's by default). */
export function clock(iso: string | null, tag?: string) {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  const today = new Date().toDateString() === date.toDateString();
  return today
    ? date.toLocaleTimeString(tag ?? [], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(tag ?? [], { month: "short", day: "numeric" });
}

/** "expires in 4 min" for a request that expires, else "". */
export function expiryPhrase(
  iso: string | null,
  now = Date.now(),
  ui: Ui = EN,
) {
  if (!iso) {
    return "";
  }
  const minutes = Math.round((Date.parse(iso) - now) / 60_000);
  if (Number.isNaN(minutes)) {
    return "";
  }
  if (minutes <= 0) {
    return ui.m.form.expiringNow;
  }
  return minutes < 60
    ? ui.f(ui.m.form.expiresIn, {
        time: new Intl.NumberFormat(ui.tag, {
          style: "unit",
          unit: "minute",
          unitDisplay: "short",
        }).format(minutes),
      })
    : ui.f(ui.m.form.expiresAt, { time: clock(iso, ui.tag) ?? "" });
}

/** " · expires in 4 min" for a request that expires, else "". */
export function expiresIn(iso: string | null, now = Date.now(), ui: Ui = EN) {
  const phrase = expiryPhrase(iso, now, ui);
  return phrase ? ` · ${phrase}` : "";
}
