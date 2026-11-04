import { Client } from "stytch";
import { describe, expect, it } from "vitest";
import { createWebLoginHandlers } from "./handlers.js";

// Public installed SDK constructor only. No handler is invoked in these
// configuration cases, so the closed loopback fixture port is never contacted.
const client = new Client({
  project_id: "project-test-login-config",
  secret: "inert-not-a-secret",
  env: "http://127.0.0.1:9",
  timeout: 100,
});
const config = {
  client,
  projectId: "project-test-login-config",
  origin: "https://commerce.invalid",
  sessionDurationMinutes: 10080,
};

describe("WEB-LOGIN trusted deployment configuration", () => {
  it.each([0, 4, 5.5, Number.NaN, Number.POSITIVE_INFINITY, 527041])(
    "rejects unsupported session lifetime %s before provider",
    (sessionDurationMinutes) => {
      expect(() =>
        createWebLoginHandlers({ ...config, sessionDurationMinutes }),
      ).toThrow("Invalid login configuration");
    },
  );
  it.each([5, 10080, 527040])(
    "accepts explicit provider-supported session lifetime %s",
    (sessionDurationMinutes) => {
      expect(() =>
        createWebLoginHandlers({ ...config, sessionDurationMinutes }),
      ).not.toThrow();
    },
  );
  it.each(["", " project-test-login-config", "project-test-login-config "])(
    "rejects missing/padded project namespace %s",
    (projectId) => {
      expect(() => createWebLoginHandlers({ ...config, projectId })).toThrow(
        "Invalid login configuration",
      );
    },
  );
  it.each([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://127.0.0.2:3000",
    "http://[::1]:3000",
  ])("accepts explicit canonical loopback origin %s", (origin) => {
    expect(() => createWebLoginHandlers({ ...config, origin })).not.toThrow();
  });
});
