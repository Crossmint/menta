import { z } from "zod";

export const requestCodeInput = z
  .object({ email: z.email().max(320) })
  .strict();
export const verifyCodeInput = z
  .object({
    code: z
      .string()
      .min(1)
      .max(128)
      .refine((code) => code === code.trim()),
  })
  .strict();
export const requestCodeResult = z.object({ sent: z.literal(true) }).strict();
export const authenticatedSession = z
  .object({ authenticated: z.literal(true), userId: z.string().min(1) })
  .strict();
export const anonymousSession = z
  .object({ authenticated: z.literal(false) })
  .strict();
export const sessionResult = z.union([authenticatedSession, anonymousSession]);
export const logoutResult = z.object({ signedOut: z.literal(true) }).strict();
export const authErrorResult = z
  .object({
    error: z.enum(["request_rejected", "authentication_failed", "unavailable"]),
  })
  .strict();
