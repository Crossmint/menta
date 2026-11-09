/** A webmail the sign-in code can be read in, with its icon in `public/mail`. */
export type Inbox = { name: string; icon: string; url: string };

const PROVIDERS = {
  // authuser picks this account when the browser is signed in to several.
  google: (email: string) => ({
    name: "Gmail",
    icon: "gmail",
    url: `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}`,
  }),
  outlook: () => ({
    name: "Outlook",
    icon: "outlook",
    url: "https://outlook.live.com/mail/",
  }),
  microsoft365: () => ({
    name: "Outlook",
    icon: "outlook",
    url: "https://outlook.office.com/mail/",
  }),
  yahoo: () => ({
    name: "Yahoo Mail",
    icon: "yahoo",
    url: "https://mail.yahoo.com",
  }),
  icloud: () => ({
    name: "iCloud Mail",
    icon: "icloud",
    url: "https://www.icloud.com/mail",
  }),
  proton: () => ({
    name: "Proton Mail",
    icon: "proton",
    url: "https://mail.proton.me",
  }),
  aol: () => ({ name: "AOL Mail", icon: "aol", url: "https://mail.aol.com" }),
  gmx: (email: string) => ({
    name: "GMX",
    icon: "gmx",
    url: `https://www.${domainOf(email)}`,
  }),
  yandex: () => ({
    name: "Yandex Mail",
    icon: "yandex",
    url: "https://mail.yandex.com",
  }),
  zoho: () => ({
    name: "Zoho Mail",
    icon: "zoho",
    url: "https://mail.zoho.com",
  }),
  fastmail: () => ({
    name: "Fastmail",
    icon: "fastmail",
    url: "https://app.fastmail.com",
  }),
} satisfies Record<string, (email: string) => Inbox>;

export type Provider = keyof typeof PROVIDERS;

export function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && Object.hasOwn(PROVIDERS, value);
}

export function domainOf(email: string) {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

/** The provider behind a well-known consumer domain, without a lookup. */
export function providerForDomain(domain: string): Provider | undefined {
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return "google";
  }
  if (/^(outlook|hotmail|live|msn)\./.test(domain)) {
    return "outlook";
  }
  if (/^(yahoo|ymail|rocketmail)\./.test(domain)) {
    return "yahoo";
  }
  if (["icloud.com", "me.com", "mac.com"].includes(domain)) {
    return "icloud";
  }
  if (
    ["proton.me", "protonmail.com", "protonmail.ch", "pm.me"].includes(domain)
  ) {
    return "proton";
  }
  if (domain === "aol.com" || domain === "aim.com") {
    return "aol";
  }
  if (/^gmx\.[a-z]+$/.test(domain)) {
    return "gmx";
  }
  if (/^yandex\.[a-z]+$/.test(domain) || domain === "ya.ru") {
    return "yandex";
  }
  if (domain === "zohomail.com" || domain === "zoho.com") {
    return "zoho";
  }
  if (domain === "fastmail.com" || domain === "fastmail.fm") {
    return "fastmail";
  }
  return undefined;
}

/**
 * The provider hosting a custom domain, from its mail servers (MX hosts):
 * Google Workspace, Microsoft 365, Zoho and the like. Domains behind a mail
 * gateway (Proofpoint, Mimecast) or their own servers get none.
 */
export function providerForMx(hosts: string[]): Provider | undefined {
  const host = (pattern: RegExp) =>
    hosts.some((name) => pattern.test(name.toLowerCase().replace(/\.$/, "")));
  if (host(/(^|\.)(google|googlemail)\.com$/)) {
    return "google";
  }
  if (host(/\.(mail\.)?protection\.outlook\.com$/)) {
    return "microsoft365";
  }
  if (host(/(^|\.)zoho\.[a-z.]+$/)) {
    return "zoho";
  }
  if (host(/(^|\.)protonmail\.ch$/)) {
    return "proton";
  }
  if (host(/\.mail\.icloud\.com$/)) {
    return "icloud";
  }
  if (host(/(^|\.)messagingengine\.com$/)) {
    return "fastmail";
  }
  if (host(/(^|\.)yandex\.(net|ru)$/)) {
    return "yandex";
  }
  return undefined;
}

export function inboxFor(provider: Provider, email: string): Inbox {
  return PROVIDERS[provider](email.trim());
}
