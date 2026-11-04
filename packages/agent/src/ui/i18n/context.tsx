"use client";

import { createContext, type ReactNode, useContext } from "react";
import { EN, type Ui, uiFor } from "./index.js";

const Context = createContext<Ui>(EN);

/**
 * The language the shared checkout components speak: the host's in the card,
 * the web app's in its dock and secure page. English without a provider.
 */
export function UiLocaleProvider({
  locale,
  children,
}: {
  /** A supported locale ("es") or any BCP 47 tag ("es-ES"). */
  locale: string | null | undefined;
  children: ReactNode;
}) {
  return <Context.Provider value={uiFor(locale)}>{children}</Context.Provider>;
}

/** The current language's strings, tag and formatter. */
export function useUi(): Ui {
  return useContext(Context);
}
