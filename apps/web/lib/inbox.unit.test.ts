import { describe, expect, it } from "vitest";
import { inboxFor, providerForDomain, providerForMx } from "./inbox";

describe("inbox", () => {
  it("opens Gmail on the signed-in account", () => {
    expect(inboxFor("google", "Ana@Gmail.com ").url).toBe(
      "https://mail.google.com/mail/?authuser=Ana%40Gmail.com",
    );
  });

  it("knows the providers' consumer domains", () => {
    expect(providerForDomain("hotmail.co.uk")).toBe("outlook");
    expect(providerForDomain("me.com")).toBe("icloud");
    expect(providerForDomain("pm.me")).toBe("proton");
    expect(inboxFor("gmx", "a@gmx.de").url).toBe("https://www.gmx.de");
    expect(providerForDomain("stytch.com")).toBeUndefined();
    expect(providerForDomain("livemail.example")).toBeUndefined();
  });

  it("reads custom domains from their mail servers", () => {
    expect(providerForMx(["alt1.aspmx.l.google.com."])).toBe("google");
    expect(providerForMx(["acme-com.mail.protection.outlook.com"])).toBe(
      "microsoft365",
    );
    expect(providerForMx(["mx.zoho.eu"])).toBe("zoho");
    expect(providerForMx(["mail.protonmail.ch"])).toBe("proton");
    expect(providerForMx(["mx01.mail.icloud.com"])).toBe("icloud");
    expect(providerForMx(["in1-smtp.messagingengine.com"])).toBe("fastmail");
    expect(providerForMx(["mx1.acme.pphosted.com"])).toBeUndefined();
    expect(providerForMx(["google.com.evil.example"])).toBeUndefined();
  });
});
