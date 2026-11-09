import type { ReactNode } from "react";
import { getI18n } from "../../lib/i18n/server";
import { SUPPORT } from "../../lib/site";
import {
  DocLink,
  DocSection,
  DocumentPage,
  DocumentTitle,
  prose,
} from "./document";

/**
 * Menta's terms and privacy policy. The documents are in English, the binding
 * text; the header follows the visitor's language, and other languages get a
 * line saying the document is English only.
 */
export async function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  /** When the document last changed, as it reads in English ("May 1, 2026"). */
  updated: string;
  /** The paragraph before the first clause. */
  intro: ReactNode;
  children: ReactNode;
}) {
  const { locale, tag, m } = await getI18n();
  return (
    <DocumentPage locale={locale} lang="en">
      <DocumentTitle
        title={title}
        before={
          locale === "en" ? null : (
            <p lang={tag} className="m-0 text-[14px] text-quiet">
              {m.help.legal.englishOnly}
            </p>
          )
        }
        after={
          <p className="m-0 text-[14px] text-muted">Last updated {updated}</p>
        }
      />
      <div className={prose}>
        <p>{intro}</p>
      </div>
      {children}
    </DocumentPage>
  );
}

/** A numbered part of a legal document, anchored by its title. */
export function Clause({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <DocSection
      id={title.toLowerCase().replace(/[^a-z]+/g, "-")}
      number={number}
      title={title}
    >
      {children}
    </DocSection>
  );
}

/** How to reach Crossmint about Menta: the closing part of both documents. */
export function Contact() {
  return (
    <p>
      Email <DocLink href={`mailto:${SUPPORT.email}`}>{SUPPORT.email}</DocLink>{" "}
      or tag <DocLink href={SUPPORT.x}>{SUPPORT.handle}</DocLink> on X. Menta is
      operated by Crossmint.
    </p>
  );
}
