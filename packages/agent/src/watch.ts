import {
  type CheckoutView,
  isSettled,
} from "@oca/crossmint-agent-checkouts/checkouts";
import type { SessionContext } from "eve/context";
import { crossmintUserId, getCheckouts } from "./crossmint.js";
import { getCheckoutPush } from "./push.js";
import { getSessionOwners } from "./web/owners.js";

/** Workflow step: read a checkout for the session's user and report whether it needs attention. */
export async function readCheckout(
  session: SessionContext["session"],
  runId: string,
): Promise<{ view: CheckoutView; settled: boolean }> {
  "use step";
  const user = crossmintUserId(session.auth.current);
  if (!user) {
    throw new Error("Sign in to follow checkouts.");
  }
  const view = await getCheckouts().get(user, runId);
  try {
    const push = getCheckoutPush();
    if (
      push &&
      (view.pending || !["queued", "running"].includes(view.status))
    ) {
      const owner = await getSessionOwners().get(session.id);
      if (
        owner?.subject === user &&
        owner.issuer === session.auth.current?.issuer
      ) {
        await push.observe(user, view, session.id);
      }
    }
  } catch {
    // Notification failures must never interrupt the purchase or reach the model.
    console.warn("Notification delivery unavailable.");
  }
  return { view, settled: isSettled(view) };
}
