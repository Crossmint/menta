import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { type Locale, landingPath } from "../../lib/i18n/locales";
import { getI18n } from "../../lib/i18n/server";
import { REPO_URL } from "../../lib/site";
import { GitHubMark } from "../_components/brand-marks";
import { Logo } from "../_components/icons";

/** The homepage's raised black button. */
function Pill({
  href,
  large = false,
  children,
}: {
  href: string;
  large?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-full font-medium transition-colors ${large ? "h-12 px-[22px] text-[15px]" : "h-9 px-4 text-sm md:h-10 md:px-[18px]"} raised bg-ink text-white hover:bg-ink-hover`}
    >
      {children}
    </Link>
  );
}

/**
 * The public pages' header (the homepage, help): the logo, GitHub, and sign-in
 * or Open Menta. It stays at the top, clear until the page scrolls under it.
 */
export async function SiteHeader({ locale }: { locale: Locale }) {
  const { m } = await getI18n(locale);
  const t = m.landing;
  const jar = await cookies();
  const signedIn = jar.has("__Host-oca_session") || jar.has("oca_session");
  return (
    <header className="sticky top-0 z-40">
      <div aria-hidden="true" className="landing-blur">
        {[1, 2, 3, 4, 5].map((layer) => (
          <div key={layer} />
        ))}
      </div>
      <div className="mx-auto flex max-w-[1200px] items-center gap-3 p-4 md:gap-8 md:px-6 md:py-[18px]">
        <Link href={landingPath(locale)} aria-label={t.nav.home}>
          <Logo size={24} />
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.crossmint.github}
            className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-quiet transition-colors hover:text-ink"
          >
            <GitHubMark width={16} height={16} />
            <span className="hidden sm:inline">{t.crossmint.github}</span>
          </a>
          {signedIn ? (
            <Pill href="/install">{t.nav.open}</Pill>
          ) : (
            <Pill href="/login?next=%2Finstall">{t.nav.signIn}</Pill>
          )}
        </div>
      </div>
    </header>
  );
}
