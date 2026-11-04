import { describe, expect, it } from "vitest";
import { readWebSessionToken } from "./web-cookie.js";

const origin = "https://commerce.invalid";
const cookie = "__Host-oca_session=cookie-token";

function request(headers: Record<string, string>) {
  return new Request(`${origin}/api/me`, { headers });
}

describe("web session cookie", () => {
  it("reads the one session cookie for this origin", () => {
    expect(readWebSessionToken(request({ cookie }), origin)).toBe(
      "cookie-token",
    );
    expect(
      readWebSessionToken(
        request({ cookie: "oca_session=plain-http-name" }),
        origin,
      ),
    ).toBeUndefined();
    expect(
      readWebSessionToken(request({ cookie: `${cookie}; ${cookie}` }), origin),
    ).toBeUndefined();
  });

  it("ignores an Authorization header", () => {
    expect(
      readWebSessionToken(
        request({ authorization: "Bearer bearer-token", cookie }),
        origin,
      ),
    ).toBe("cookie-token");
    expect(
      readWebSessionToken(
        request({ authorization: "Bearer bearer-token" }),
        origin,
      ),
    ).toBeUndefined();
  });
});
