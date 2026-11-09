import { describe, expect, it, vi } from "vitest";

vi.mock("geist/font/sans", () => ({ GeistSans: { variable: "" } }));
vi.mock("geist/font/mono", () => ({ GeistMono: { variable: "" } }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined }),
}));

import { metadata as root } from "../layout";
import { helpMetadata, landingMetadata } from "./meta";

describe("homepage metadata", () => {
  // A page that sets openGraph or twitter replaces the layout's objects whole,
  // dropping the social image and the large card (it happened on launch).
  it("inherits the site's social card instead of replacing it", async () => {
    const home = await landingMetadata("ja");
    expect(home).not.toHaveProperty("openGraph");
    expect(home).not.toHaveProperty("twitter");
    expect(root.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("links every language's homepage", async () => {
    const home = await landingMetadata("es");
    expect(home.alternates?.canonical).toBe("/es");
    expect(home.alternates?.languages).toMatchObject({
      en: "/",
      "pt-BR": "/pt",
      "zh-CN": "/zh",
      "x-default": "/",
    });
  });

  it("links every language's help page", async () => {
    const help = await helpMetadata("ja");
    expect(help).not.toHaveProperty("openGraph");
    expect(help.alternates?.canonical).toBe("/ja/help");
    expect(help.alternates?.languages).toMatchObject({
      en: "/help",
      "pt-BR": "/pt/help",
      "x-default": "/help",
    });
  });
});
