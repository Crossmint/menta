import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getGoogleLoginHandlers, getWebLoginHandlers } from "./runtime";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("STYTCH_PROJECT_ID", "project-test-google-fixture");
  vi.stubEnv("STYTCH_SECRET", "inert-fixture-secret");
  vi.stubEnv("OCA_WEB_ORIGIN", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN", "");
});
afterEach(() => vi.unstubAllEnvs());

it("optional Google configuration does not disable email login", () => {
  expect(getWebLoginHandlers()).not.toBeNull();
  expect(getGoogleLoginHandlers()).toBeNull();
});

it("matching Google public configuration composes without provider calls", () => {
  vi.stubEnv(
    "NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN",
    "public-token-test-google-fixture",
  );
  expect(getGoogleLoginHandlers()).not.toBeNull();
});

it("an environment mismatch disables Google while preserving email", () => {
  vi.stubEnv(
    "NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN",
    "public-token-live-google-fixture",
  );
  expect(getGoogleLoginHandlers()).toBeNull();
  expect(getWebLoginHandlers()).not.toBeNull();
});

it("production rejects a local HTTP authentication origin", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv(
    "NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN",
    "public-token-test-google-fixture",
  );
  expect(getGoogleLoginHandlers()).toBeNull();
  expect(getWebLoginHandlers()).toBeNull();
});
