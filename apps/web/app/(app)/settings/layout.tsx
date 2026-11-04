import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PRIVATE } from "../../../lib/site";

export const metadata: Metadata = {
  title: "Settings",
  robots: PRIVATE,
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
