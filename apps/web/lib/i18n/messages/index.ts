import type { Locale } from "../locales";
import type en from "./en";

/** English is the source; every other language has exactly its shape (checked by the compiler). */
export type Messages = typeof en;

const loaders: Record<Locale, () => Promise<{ default: Messages }>> = {
  en: () => import("./en"),
  es: () => import("./es"),
  fr: () => import("./fr"),
  de: () => import("./de"),
  it: () => import("./it"),
  pt: () => import("./pt"),
  nl: () => import("./nl"),
  pl: () => import("./pl"),
  sv: () => import("./sv"),
  nb: () => import("./nb"),
  da: () => import("./da"),
  fi: () => import("./fi"),
  hi: () => import("./hi"),
  ja: () => import("./ja"),
  ko: () => import("./ko"),
  zh: () => import("./zh"),
};

export async function loadMessages(locale: Locale): Promise<Messages> {
  return (await loaders[locale]()).default;
}
