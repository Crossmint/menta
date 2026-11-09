import { describe, expect, it } from "vitest";
import { clearWebSessionCookie, writeWebSessionCookies } from "./cookies";

/** A Set-Cookie's name and the attributes a browser matches it by. */
function identity(header: string) {
  const [pair = "", ...attributes] = header.split("; ");
  const name = pair.slice(0, pair.indexOf("="));
  const kept = attributes
    .filter((attribute) => !attribute.startsWith("Max-Age="))
    .sort();
  return { name, attributes: kept };
}

describe("clearWebSessionCookie", () => {
  it.each(["https://menta.example", "http://localhost:3000"])(
    "expires the very cookie sign-in writes on %s",
    (origin) => {
      const written = writeWebSessionCookies(new Response(null), {
        origin,
        sessionToken: "token",
        sessionDurationMinutes: 60,
      }).headers.getSetCookie()[0];
      const cleared = clearWebSessionCookie(
        new Response(null),
        origin,
      ).headers.getSetCookie();
      expect(cleared).toHaveLength(1);
      expect(identity(cleared[0] ?? "")).toEqual(identity(written ?? ""));
      expect(cleared[0]).toContain("Max-Age=0");
    },
  );
});
