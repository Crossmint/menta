import type { SessionContext } from "eve/context";
import extension from "../extension.js";
import { CheckoutError } from "./checkouts.js";

export function checkoutsFor(ctx: Pick<SessionContext, "session">) {
  const { checkouts, userId } = extension.config;
  const user = userId(ctx.session.auth.current);
  if (!user) {
    throw new CheckoutError("Sign in to use checkouts.");
  }
  return { checkouts: checkouts(), user };
}
