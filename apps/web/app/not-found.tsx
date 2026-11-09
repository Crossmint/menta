import Link from "next/link";
import { getI18n } from "../lib/i18n/server";
import { Search } from "./_components/icons";
import { Outcome, primaryAction, Standalone } from "./_components/standalone";

/**
 * The root 404. It handles every unmatched URL and any `notFound()` call
 * without a nearer boundary, and renders inside the root layout only, so the
 * signed-in `(app)` sidebar never wraps it.
 */
export default async function NotFound() {
  const { m } = await getI18n();
  return (
    <Standalone>
      <Outcome
        icon={<Search width={26} height={26} />}
        title={m.auth.notFound.title}
        lede={m.auth.notFound.lede}
      >
        <Link href="/" className={primaryAction}>
          {m.auth.notFound.home}
        </Link>
      </Outcome>
    </Standalone>
  );
}
