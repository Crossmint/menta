import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getI18n } from "../../lib/i18n/server";
import { PRIVATE } from "../../lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return {
    title: m.auth.authorize.title,
    robots: PRIVATE,
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
