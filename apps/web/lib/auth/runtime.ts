import { Client } from "stytch";
import { z } from "zod";
import { createGoogleLoginHandlers } from "./google";
import { createWebLoginHandlers } from "./handlers";

const value = z
  .string()
  .min(1)
  .refine((text) => text === text.trim());
const runtimeConfig = z.object({
  projectId: value,
  secret: value,
  origin: z.url().refine((text) => {
    try {
      const url = new URL(text);
      return (
        url.origin === text &&
        (url.protocol === "https:" ||
          (process.env.NODE_ENV !== "production" &&
            url.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
      );
    } catch {
      return false;
    }
  }),
});
const googleConfig = runtimeConfig.extend({ publicToken: value });

/** Google is optional; its public token is not an email-login prerequisite. */
export function getGoogleLoginHandlers() {
  const config = googleConfig.safeParse({
    projectId: process.env.STYTCH_PROJECT_ID,
    secret: process.env.STYTCH_SECRET,
    origin: process.env.OCA_WEB_ORIGIN,
    publicToken: process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN,
  });
  if (!config.success) {
    return null;
  }
  try {
    return createGoogleLoginHandlers({
      ...config.data,
      client: new Client({
        project_id: config.data.projectId,
        secret: config.data.secret,
        timeout: 10000,
      }),
      sessionDurationMinutes: 10080,
    });
  } catch {
    return null;
  }
}

/** Missing configuration never enables a fallback login provider. */
export function getWebLoginHandlers() {
  const config = runtimeConfig.safeParse({
    projectId: process.env.STYTCH_PROJECT_ID,
    secret: process.env.STYTCH_SECRET,
    origin: process.env.OCA_WEB_ORIGIN,
  });
  if (!config.success) {
    return null;
  }
  try {
    return createWebLoginHandlers({
      ...config.data,
      client: new Client({
        project_id: config.data.projectId,
        secret: config.data.secret,
        timeout: 10000,
      }),
      sessionDurationMinutes: 10080,
      codeEmailTemplates:
        process.env.OCA_CODE_EMAIL_TEMPLATES?.trim() || undefined,
    });
  } catch {
    return null;
  }
}
