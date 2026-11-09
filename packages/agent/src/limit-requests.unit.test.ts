import { describe, expect, it } from "vitest";
import {
  LIMIT_REQUEST_TTL_MS,
  type LimitRequest,
  limitRequestKey,
  openLimitRequest,
  sealLimitRequest,
} from "./limit-requests.js";

const key = limitRequestKey({ STYTCH_SECRET: "secret-1" }) as Buffer;
const asked: LimitRequest = {
  name: "Groceries",
  amount: "80.00",
  currency: "EUR",
  expires: "month",
  store: "amazon.es",
  runId: "run-1",
  via: "claude",
};
const now = 1_800_000_000_000;

describe("spending limit request links", () => {
  it("opens for the user it was sealed for", () => {
    const token = sealLimitRequest(key, "user-1", asked, now);
    expect(openLimitRequest(key, "user-1", token, now)).toEqual(asked);
  });

  it("says nothing about the request in the link", () => {
    const token = sealLimitRequest(key, "user-1", asked, now);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    for (const part of ["Groceries", "80.00", "amazon", "run-1", "user-1"]) {
      expect(token).not.toContain(part);
      expect(Buffer.from(token, "base64url").toString("utf8")).not.toContain(
        part,
      );
    }
  });

  it("refuses another user", () => {
    const token = sealLimitRequest(key, "user-1", asked, now);
    expect(openLimitRequest(key, "user-2", token, now)).toBeNull();
  });

  it("expires after a day", () => {
    const token = sealLimitRequest(key, "user-1", asked, now);
    expect(
      openLimitRequest(key, "user-1", token, now + LIMIT_REQUEST_TTL_MS - 1),
    ).toEqual(asked);
    expect(
      openLimitRequest(key, "user-1", token, now + LIMIT_REQUEST_TTL_MS + 1),
    ).toBeNull();
  });

  it("refuses a changed token or another key", () => {
    const token = sealLimitRequest(key, "user-1", asked, now);
    const raw = Buffer.from(token, "base64url");
    raw[20] ^= 1;
    expect(
      openLimitRequest(key, "user-1", raw.toString("base64url"), now),
    ).toBeNull();
    const other = limitRequestKey({ STYTCH_SECRET: "secret-2" }) as Buffer;
    expect(openLimitRequest(other, "user-1", token, now)).toBeNull();
    expect(openLimitRequest(key, "user-1", "short", now)).toBeNull();
    expect(openLimitRequest(key, "user-1", "", now)).toBeNull();
  });

  it("has no key without the Stytch secret", () => {
    expect(limitRequestKey({})).toBeNull();
    expect(limitRequestKey({ STYTCH_SECRET: "  " })).toBeNull();
  });
});
