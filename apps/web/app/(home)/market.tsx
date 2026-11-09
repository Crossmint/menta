"use client";

import { createContext, type ReactNode, useContext } from "react";
import { type Market, marketFor } from "./markets";

const MarketContext = createContext<Market>(marketFor(null));

/** The visitor's market (markets.ts), for the homepage's client parts. */
export function MarketProvider({
  market,
  children,
}: {
  market: Market;
  children: ReactNode;
}) {
  return (
    <MarketContext.Provider value={market}>{children}</MarketContext.Provider>
  );
}

export function useMarket() {
  return useContext(MarketContext);
}
