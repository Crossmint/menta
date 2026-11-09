import { describe, expect, it } from "vitest";
import {
  createStoreBrands,
  type Fetched,
  lookupStoreBrand,
  type StoreFetch,
  siteOf,
} from "./store-brand.js";

const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

/** A fake web: URL → response. */
function site(
  pages: Record<
    string,
    Partial<Omit<Fetched, "body">> & { body?: Buffer | string }
  >,
) {
  const asked: string[] = [];
  const fetch: StoreFetch = async (url) => {
    asked.push(url.href);
    const page = pages[url.href];
    if (!page) {
      return { status: 404, type: "text/html", body: Buffer.from(""), url };
    }
    return {
      status: page.status ?? 200,
      type: page.type ?? "text/html",
      body: Buffer.isBuffer(page.body)
        ? page.body
        : Buffer.from(page.body ?? ""),
      url,
      ...(page.partial ? { partial: true } : {}),
    };
  };
  return { fetch, asked };
}

describe("a store's name and icon from its own site", () => {
  it("takes only public site names", () => {
    expect(siteOf("WWW.PuraVidaMiami.com")).toBe("puravidamiami.com");
    expect(siteOf("https://shop.example.co.uk/path")).toBe(
      "shop.example.co.uk",
    );
    for (const bad of [
      "localhost",
      "10.0.0.1",
      "169.254.169.254",
      "printer.local",
      "x",
      "a b.com",
    ]) {
      expect(siteOf(bad), bad).toBeNull();
    }
  });

  it("prefers the site's own name, in normal case, and the manifest's biggest icon", async () => {
    const web = site({
      "https://puravidamiami.com/": {
        body: `<html><head><title>Home | Pura Vida</title>
          <meta property="og:site_name" content="PURA VIDA MIAMI">
          <link rel="manifest" href="/site.webmanifest">
          <link rel="apple-touch-icon" href="/apple.png">
          <link rel="icon" href="/favicon-32.png" sizes="32x32"></head><body></body></html>`,
      },
      "https://puravidamiami.com/site.webmanifest": {
        type: "application/manifest+json",
        body: JSON.stringify({
          name: "Pura Vida",
          icons: [
            { src: "/icon-192.png", sizes: "192x192" },
            { src: "/icon-512.png", sizes: "512x512" },
            { src: "/mask-512.png", sizes: "512x512", purpose: "maskable" },
          ],
        }),
      },
      "https://puravidamiami.com/icon-512.png": {
        type: "image/png",
        body: png,
      },
    });
    const brand = await lookupStoreBrand("puravidamiami.com", web.fetch);
    expect(brand.name).toBe("Pura Vida Miami");
    expect(brand.icon?.type).toBe("image/png");
    expect(web.asked).not.toContain("https://puravidamiami.com/mask-512.png");
  });

  it("falls back to the page title and the iPhone icon, and keeps short brand names as written", async () => {
    const web = site({
      "https://ikea.com/": {
        body: `<head><title>IKEA – Furniture</title><link rel="apple-touch-icon" href="https://cdn.ikea.com/a.png"></head>`,
      },
      "https://cdn.ikea.com/a.png": { type: "image/png", body: png },
    });
    expect(await lookupStoreBrand("ikea.com", web.fetch)).toMatchObject({
      name: "IKEA",
      icon: { type: "image/png" },
    });
  });

  it("serves only real images, never a page or a cut-off file", async () => {
    const web = site({
      "https://shop.example/": {
        body: `<head><link rel="icon" href="/x.png"></head>`,
      },
      "https://shop.example/x.png": {
        type: "image/png",
        body: "<html>not an image</html>",
      },
      "https://shop.example/apple-touch-icon.png": {
        type: "image/png",
        body: png,
        partial: true,
      },
      "https://shop.example/favicon.ico": { type: "image/x-icon", body: "" },
    });
    expect((await lookupStoreBrand("shop.example", web.fetch)).icon).toBeNull();
    const svg = site({
      "https://svg.example/": {
        body: `<head><link rel="icon" href="/i.svg" type="image/svg+xml"></head>`,
      },
      "https://svg.example/i.svg": {
        type: "text/plain",
        body: `<svg xmlns="http://www.w3.org/2000/svg"></svg>`,
      },
    });
    expect((await lookupStoreBrand("svg.example", svg.fetch)).icon?.type).toBe(
      "image/svg+xml",
    );
  });

  it("never throws, and drops names that are links", async () => {
    const down: StoreFetch = async () => {
      throw new Error("ECONNREFUSED");
    };
    expect(await lookupStoreBrand("down.example", down)).toEqual({
      name: null,
      icon: null,
    });
    const web = site({
      "https://link.example/": {
        body: `<head><meta property="og:site_name" content="https://link.example/"></head>`,
      },
    });
    expect((await lookupStoreBrand("link.example", web.fetch)).name).toBeNull();
  });

  it("caches per site and gives a slow site nothing for now", async () => {
    let calls = 0;
    const slow: StoreFetch = () => {
      calls++;
      return new Promise(() => {});
    };
    const brands = createStoreBrands({ fetch: slow, budgetMs: 20 });
    expect(await brands("slow.example")).toEqual({ name: null, icon: null });
    await brands("slow.example");
    expect(calls).toBe(1);
  });

  it("reads only a few sites at once, and doesn't keep the ones it skipped", async () => {
    const asked: string[] = [];
    const slow: StoreFetch = (url) => {
      asked.push(url.hostname);
      return new Promise(() => {});
    };
    const brands = createStoreBrands({
      fetch: slow,
      budgetMs: 20,
      concurrent: 2,
    });
    await Promise.all(["a.example", "b.example", "c.example"].map(brands));
    expect(asked).toEqual(["a.example", "b.example"]);
  });
});
