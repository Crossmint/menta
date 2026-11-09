import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

function visit(path: string, headers: Record<string, string> = {}) {
  return proxy(new NextRequest(`https://menta.test${path}`, { headers }));
}

/** The locale the proxy hands the page, when it lets the request through. */
function locale(response: Response) {
  return response.headers.get("x-middleware-request-x-menta-locale");
}

describe("proxy", () => {
  it("lets signed-in people through to the app", () => {
    const response = visit("/install", { cookie: "__Host-oca_session=s" });
    expect(response.headers.get("location")).toBeNull();
  });

  it("sends signed-out visits to the app to sign-in, coming back to it", () => {
    for (const path of [
      "/chat",
      "/install",
      "/connections",
      "/wallet",
      "/transactions",
    ]) {
      const response = visit(path);
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        `https://menta.test/login?next=${encodeURIComponent(path)}`,
      );
    }
  });

  it("keeps where they were going, query included", () => {
    const response = visit("/settings?x=1");
    expect(response.headers.get("location")).toBe(
      "https://menta.test/login?next=%2Fsettings%3Fx%3D1",
    );
  });

  it("leaves public pages public", () => {
    for (const path of [
      "/",
      "/login",
      "/connect",
      "/ja",
      "/help",
      "/ja/help",
    ]) {
      expect(visit(path).headers.get("location")).toBeNull();
    }
  });

  it("sends the homepage to the visitor's language", () => {
    const response = visit("/", {
      "accept-language": "ja-JP,ja;q=0.9,en;q=0.8",
    });
    expect(response.headers.get("location")).toBe("https://menta.test/ja");
  });

  it("lets a picked language win over the browser's", () => {
    const english = visit("/", {
      "accept-language": "ja",
      cookie: "menta_locale=en",
    });
    expect(english.headers.get("location")).toBeNull();
    expect(locale(english)).toBe("en");
    const spanish = visit("/settings", {
      "accept-language": "ja",
      cookie: "__Host-oca_session=s; menta_locale=es",
    });
    expect(locale(spanish)).toBe("es");
  });

  it("takes the homepage's language from its URL", () => {
    expect(locale(visit("/ko", { cookie: "menta_locale=fr" }))).toBe("ko");
    expect(visit("/en").headers.get("location")).toBe("https://menta.test/");
  });

  it("gives help one URL per language, like the homepage", () => {
    const response = visit("/help?x=1", { "accept-language": "de-DE,de" });
    expect(response.headers.get("location")).toBe(
      "https://menta.test/de/help?x=1",
    );
    expect(locale(visit("/fr/help", { cookie: "menta_locale=ja" }))).toBe("fr");
    expect(locale(visit("/help"))).toBe("en");
    expect(visit("/en/help").headers.get("location")).toBe(
      "https://menta.test/help",
    );
  });

  it("falls back to English", () => {
    expect(locale(visit("/login", { "accept-language": "tr-TR" }))).toBe("en");
  });
});
