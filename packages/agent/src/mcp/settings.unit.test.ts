import { describe, expect, it } from "vitest";
import { accountUrl, accountViewHtml } from "./account-view.js";
import {
  defaultAddressSetting,
  noDefaultOption,
  offersSettings,
  settingsReadResult,
} from "./settings.js";

describe("plugin settings", () => {
  it("offers settings only to the local dev host", () => {
    // ChatGPT draws them, but now gets manage's links instead.
    expect(offersSettings("chatgpt")).toBe(false);
    expect(offersSettings("local")).toBe(true);
    expect(offersSettings("claude")).toBe(false);
    expect(offersSettings(null)).toBe(false);
  });

  it("lists each saved label once, then None, with the default selected", () => {
    expect(
      defaultAddressSetting([
        { label: "Home", isDefault: false },
        { label: "Saved address", isDefault: false },
        { label: "Saved address", isDefault: false },
        { label: "Work", isDefault: true },
      ]),
    ).toEqual({
      options: ["Home", "Saved address", "Work", "None"],
      none: "None",
      value: "Work",
    });
    expect(defaultAddressSetting([])).toEqual({
      options: ["None"],
      none: "None",
      value: "None",
    });
  });

  it("renames the no-default option when an address is labelled None", () => {
    expect(noDefaultOption(["none"])).toBe("No default");
    expect(noDefaultOption(["None", "No default"])).toBe("(none)");
    expect(defaultAddressSetting([{ label: "None", isDefault: true }])).toEqual(
      {
        options: ["None", "No default"],
        none: "No default",
        value: "None",
      },
    );
  });

  it("returns a value for every schema property, and layout only names real ones", () => {
    const result = settingsReadResult(
      [{ label: "Home", isDefault: true }],
      null,
    );
    expect(Object.keys(result.values)).toEqual(
      Object.keys(result.schema.properties),
    );
    const properties = result.layout.flatMap((group) =>
      group.items.flatMap((item) =>
        item.kind === "property" ? [item.property] : [],
      ),
    );
    expect(properties).toEqual(["defaultAddress"]);
    expect(JSON.stringify(result)).toContain(
      "If you sign in to a store during a checkout",
    );
  });

  it("links only to our own Settings sections", () => {
    expect(accountUrl("https://commerce.invalid/", "cards")).toBe(
      "https://commerce.invalid/wallet#cards",
    );
    expect(accountUrl("https://commerce.invalid", "add-address")).toBe(
      "https://commerce.invalid/addresses#add-address",
    );
    // Only the origin is baked in, attribute-escaped.
    const html = accountViewHtml('https://commerce.invalid/x"><script>');
    expect(html).toContain(
      '<meta name="oca-origin" content="https://commerce.invalid">',
    );
    expect(html).not.toContain('"><script>');
    // The inline script parses (it runs only in the host's sandbox).
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1] ?? "";
    expect(script).toContain("ui/initialize");
    expect(() => new Function(script)).not.toThrow();
  });
});
