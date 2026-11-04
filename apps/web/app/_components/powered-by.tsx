"use client";

import { useI18n } from "../../lib/i18n/client";
import { rich } from "../../lib/i18n/rich";
import { CrossmintLogo } from "./brand-marks";

/** Crossmint keeps the cards: its mark under them, as on the homepage. */
export function PoweredByCrossmint() {
  const { m } = useI18n();
  return (
    <p className="m-0 inline-flex items-center gap-1.5 self-center text-[12px] text-muted">
      {rich(m.app.wallet.poweredBy, {
        crossmint: (
          <CrossmintLogo
            role="img"
            aria-label="Crossmint"
            aria-hidden={undefined}
            className="h-[12px] w-auto text-ink"
          />
        ),
      })}
    </p>
  );
}
