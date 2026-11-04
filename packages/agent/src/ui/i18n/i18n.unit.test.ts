import { describe, expect, it } from "vitest";
import { expiresIn, money } from "../format.js";
import { describeCheckout, runStatus } from "../status.js";
import { en } from "./en.js";
import {
  around,
  capitalize,
  EN,
  format,
  localeTag,
  pickLocale,
  sentences,
  UI_LOCALES,
  type Ui,
  uiFor,
} from "./index.js";

describe("the checkout UI's languages", () => {
  it("maps a BCP 47 tag to the nearest supported language", () => {
    expect(pickLocale("es-ES")).toBe("es");
    expect(pickLocale("pt-BR")).toBe("pt");
    expect(pickLocale("pt-PT")).toBe("pt");
    expect(pickLocale("nb-NO")).toBe("nb");
    expect(pickLocale("no")).toBe("nb");
    expect(pickLocale("nn-NO")).toBe("nb");
    expect(pickLocale("zh-Hans")).toBe("zh");
    expect(pickLocale("zh-CN")).toBe("zh");
    expect(pickLocale("zh-TW")).toBe("zh");
    expect(pickLocale("JA")).toBe("ja");
    expect(pickLocale("de_DE")).toBe("de");
    expect(pickLocale("tlh")).toBe("en");
    expect(pickLocale("")).toBe("en");
    expect(pickLocale(undefined)).toBe("en");
    expect(pickLocale(null)).toBe("en");
  });

  it("has every language the web app has, each with its Intl tag", () => {
    expect(UI_LOCALES).toHaveLength(16);
    expect(uiFor("pt").tag).toBe("pt-BR");
    expect(uiFor("zh-TW").tag).toBe("zh-CN");
    expect(uiFor("es").m.common.yes).toBe("Sí");
    expect(uiFor("en")).toBe(EN);
  });

  it("keeps only short language tags", () => {
    expect(localeTag("es-ES")).toBe("es-ES");
    expect(localeTag("zh-Hant-TW")).toBe("zh-Hant-TW");
    expect(localeTag("en")).toBe("en");
    expect(localeTag("e")).toBeNull();
    expect(localeTag("es ES")).toBeNull();
    expect(localeTag("es-ES; drop table")).toBeNull();
    expect(localeTag("<script>")).toBeNull();
    expect(localeTag(`en-${"a1234567-".repeat(5)}x`)).toBeNull();
    expect(localeTag(42)).toBeNull();
    expect(localeTag(undefined)).toBeNull();
  });

  it("fills placeholders and leaves unknown ones as written", () => {
    expect(format("Approve {amount}", { amount: "$5.00" })).toBe(
      "Approve $5.00",
    );
    expect(format("{a} · {b}", { a: 1 })).toBe("1 · {b}");
    expect(format("No placeholders")).toBe("No placeholders");
    expect(around(en.common.poweredBy, "logo")).toEqual(["Powered by ", ""]);
    expect(around("{logo} 提供", "logo")).toEqual(["", " 提供"]);
    expect(capitalize("expires in 4 min", "en")).toBe("Expires in 4 min");
  });

  it("formats money and times in the language's own way", () => {
    expect(money({ amount: "31.5", currency: "USD" })).toBe("$31.50");
    expect(money({ amount: "31.5", currency: "EUR" }, uiFor("de"))).toMatch(
      /^31,50\s€$/,
    );
    const now = Date.parse("2026-10-05T12:00:00.000Z");
    expect(expiresIn("2026-10-05T12:04:00.000Z", now)).toBe(
      " · expires in 4 min",
    );
    expect(expiresIn("2026-10-05T11:00:00.000Z", now)).toBe(" · expiring now");
    expect(expiresIn(null, now)).toBe("");
  });

  it("reads status lines from the catalog it is given", () => {
    const es: Ui = {
      ...EN,
      locale: "es",
      tag: "es",
      m: {
        ...en,
        status: {
          ...en.status,
          readyToPay: "Listo para pagar",
          couldntBuyBecause: "No se pudo comprar · {reason}",
        },
        blocked: {
          ...en.blocked,
          "merchant.payment_declined": "Pago rechazado",
        },
      },
    };
    expect(
      runStatus(
        { status: "awaiting_input", pending: { kind: "payment" } },
        {},
        es,
      ).label,
    ).toBe("Listo para pagar");
    expect(
      describeCheckout(
        {
          status: "blocked",
          pending: null,
          result: { blockedCode: "merchant.payment_declined" },
        },
        es,
      ).label,
    ).toBe("No se pudo comprar · Pago rechazado");
    // English stays the default.
    expect(
      runStatus({ status: "awaiting_input", pending: { kind: "payment" } })
        .label,
    ).toBe("Ready to pay");
  });
});

describe("sentences", () => {
  it("ends each part once, in the language's own full stop", () => {
    expect(
      sentences(uiFor("en"), ["Item unavailable", "“Closed right now.”"]),
    ).toBe("Item unavailable. “Closed right now.”");
    expect(sentences(uiFor("en"), ["Stopped.", null, "Try again"])).toBe(
      "Stopped. Try again.",
    );
    expect(
      sentences(uiFor("ja"), ["商品を購入できません", "「Closed right now.」"]),
    ).toBe("商品を購入できません。「Closed right now.」");
    expect(sentences(uiFor("zh"), ["已取消。"])).toBe("已取消。");
    // Hindi ends with its danda, as its catalog does, and once.
    expect(
      sentences(uiFor("hi"), ["भुगतान अस्वीकार हुआ", "चेकआउट रद्द कर दिया गया।"]),
    ).toBe("भुगतान अस्वीकार हुआ। चेकआउट रद्द कर दिया गया।");
    // German and Danish quotes close with “ and «: a quoted stop is the only one.
    expect(sentences(uiFor("de"), ["„Geschlossen.“"])).toBe("„Geschlossen.“");
    expect(sentences(uiFor("da"), ["»Lukket.«"])).toBe("»Lukket.«");
    expect(sentences(uiFor("en"), [])).toBe("");
  });

  it("gives every language its own catalog", () => {
    for (const locale of UI_LOCALES) {
      if (locale !== "en") {
        expect(uiFor(locale).m, locale).not.toBe(en);
      }
    }
  });
});
