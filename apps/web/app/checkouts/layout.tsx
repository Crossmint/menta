import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getI18n } from "../../lib/i18n/server";
import { PRIVATE } from "../../lib/site";

/**
 * The secure page's metadata. Its link preview comes from sign-in, which
 * crawlers land on signed out (login/preview.ts): never the item, price,
 * store or who it's for.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return {
    // The page names itself per step (payment, question, live, done).
    title: m.checkout.preview.title,
    description: m.checkout.preview.description,
    robots: PRIVATE,
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
