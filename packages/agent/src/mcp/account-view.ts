/**
 * The small MCP Apps view behind the settings buttons "Manage cards" and
 * "Add an address": ChatGPT renders it in a modal over the plugin's settings.
 * It shows the Settings copy for that section and one button that opens the
 * section on our origin (`ui/open-link`, then ChatGPT's `openExternal`, then
 * a new tab). Card details stay on Menta, in Crossmint's own form;
 * nothing sensitive passes through this view or its tool results.
 *
 * Self-contained on purpose (no build step, no SDK runtime): the only link it
 * can open is the section's page on our origin (`/wallet#cards`,
 * `/addresses#add-address`), with the origin baked in by the server and the
 * section from a fixed list.
 */

import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";

export const ACCOUNT_VIEW_URI = "ui://oca/account";
export const ACCOUNT_VIEW_MIME_TYPE = RESOURCE_MIME_TYPE;

/** Settings anchors the view links to; `add-address` opens the add form. */
export const ACCOUNT_SECTIONS = ["cards", "add-address"] as const;
export type AccountSection = (typeof ACCOUNT_SECTIONS)[number];

export const ACCOUNT_VIEW_DESCRIPTION =
  "Opens the user's Menta account to add or change cards and delivery addresses.";

/** Each section's page: cards live in Wallet, addresses in Addresses. */
const SECTION_PATHS: Readonly<Record<AccountSection, string>> = {
  cards: "/wallet#cards",
  "add-address": "/addresses#add-address",
};

/** The link for a section, on our origin only. */
export function accountUrl(origin: string, section: AccountSection) {
  return `${new URL(origin).origin}${SECTION_PATHS[section]}`;
}

/** Resource metadata: no network access, links only to our origin. */
export function accountViewResourceMeta(origin: string) {
  return {
    ui: {
      csp: { connectDomains: [], resourceDomains: [], frameDomains: [] },
      prefersBorder: true,
    },
    "openai/widgetCSP": {
      connect_domains: [],
      resource_domains: [],
      frame_domains: [],
      redirect_domains: [origin],
    },
    "openai/widgetDomain": origin,
    "openai/widgetPrefersBorder": true,
    "openai/widgetDescription": ACCOUNT_VIEW_DESCRIPTION,
  };
}

function attribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const script = `
const root = document.documentElement;
const origin = document.querySelector('meta[name="oca-origin"]').content;
const sections = ${JSON.stringify(ACCOUNT_SECTIONS)};
const view = document.getElementById("view");
const button = document.getElementById("open");
let nextId = 1;
let section = null;
const waiting = new Map();

function post(message) {
  window.parent.postMessage({ jsonrpc: "2.0", ...message }, "*");
}
function request(method, params, timeoutMs = 15000) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      reject(new Error(method + " timed out"));
    }, timeoutMs);
    waiting.set(id, (message) => {
      clearTimeout(timer);
      if ("error" in message) {
        reject(new Error("Host error"));
      } else {
        resolve(message.result);
      }
    });
    post({ id, method, params });
  });
}
function size() {
  requestAnimationFrame(() => {
    post({
      method: "ui/notifications/size-changed",
      params: {
        width: Math.ceil(root.scrollWidth),
        height: Math.ceil(document.body.scrollHeight),
      },
    });
  });
}
function applyContext(context) {
  if (!context || typeof context !== "object") {
    return;
  }
  if (context.theme === "light" || context.theme === "dark") {
    root.dataset.theme = context.theme;
  }
  const variables = context.styles && context.styles.variables;
  if (variables && typeof variables === "object") {
    for (const [name, value] of Object.entries(variables)) {
      if (/^--[a-z0-9-]+$/.test(name) && typeof value === "string" && value.length < 300) {
        root.style.setProperty(name, value);
      }
    }
  }
}
function text(value, max) {
  return typeof value === "string" && value.length <= max ? value : null;
}
function show(structured) {
  if (!structured || typeof structured !== "object" || !sections.includes(structured.section)) {
    return;
  }
  const title = text(structured.title, 120);
  const body = text(structured.text, 600);
  const action = text(structured.action, 60);
  if (!title || !body || !action) {
    return;
  }
  section = structured.section;
  document.getElementById("title").textContent = title;
  document.getElementById("text").textContent = body;
  button.textContent = action;
  document.getElementById("note").textContent = "Opens " + new URL(origin).host;
  view.hidden = false;
  size();
}
async function open() {
  if (!section) {
    return;
  }
  const url = origin + (section === "cards" ? "/wallet#cards" : "/addresses#add-address");
  button.disabled = true;
  setTimeout(() => {
    button.disabled = false;
  }, 1500);
  try {
    await request("ui/open-link", { url });
    return;
  } catch {}
  try {
    if (window.openai && typeof window.openai.openExternal === "function") {
      window.openai.openExternal({ href: url });
      return;
    }
  } catch {}
  window.open(url, "_blank", "noopener,noreferrer");
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) {
    return;
  }
  const message = event.data;
  if (!message || typeof message !== "object" || message.jsonrpc !== "2.0") {
    return;
  }
  if (typeof message.method === "string") {
    if (message.id !== undefined) {
      post({ id: message.id, result: {} });
    } else if (message.method === "ui/notifications/tool-result") {
      show(message.params && message.params.structuredContent);
    } else if (message.method === "ui/notifications/host-context-changed") {
      applyContext(message.params);
    }
    return;
  }
  const settle = waiting.get(message.id);
  if (settle) {
    waiting.delete(message.id);
    settle(message);
  }
});
window.addEventListener("openai:set_globals", () => {
  show(window.openai && window.openai.toolOutput);
});
button.addEventListener("click", () => void open());

show(window.openai && window.openai.toolOutput);
request("ui/initialize", {
  appInfo: { name: "oca-account", version: "1.0.0" },
  appCapabilities: { availableDisplayModes: ["inline"] },
  protocolVersion: "2026-01-26",
}, 20000)
  .then((result) => {
    applyContext(result && result.hostContext);
    post({ method: "ui/notifications/initialized", params: {} });
    size();
  })
  .catch(() => {});
`;

/** The view document, bound to our origin. */
export function accountViewHtml(origin: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="oca-origin" content="${attribute(new URL(origin).origin)}">
<title>Menta</title>
<style>
:root {
  color-scheme: light dark;
  --oc-ink: #0a0a0a;
  --oc-muted: #6b6b6b;
  --oc-surface: #ffffff;
  font-family: var(--font-sans, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif);
}
:root[data-theme="dark"] { --oc-ink: #f5f5f5; --oc-muted: #a3a3a3; --oc-surface: #0a0a0a; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) { --oc-ink: #f5f5f5; --oc-muted: #a3a3a3; --oc-surface: #0a0a0a; }
}
body { margin: 0; background: transparent; color: var(--color-text-primary, var(--oc-ink)); }
main { display: flex; flex-direction: column; gap: 12px; padding: 20px; }
main[hidden] { display: none; }
h1 { margin: 0; font-size: 13px; font-weight: 500; color: var(--color-text-secondary, var(--oc-muted)); }
p { margin: 0; font-size: 14px; line-height: 1.45; }
.note { font-size: 13px; color: var(--color-text-secondary, var(--oc-muted)); }
button {
  align-self: flex-start; height: 36px; padding: 0 16px; border: 0; border-radius: 999px;
  background: var(--color-text-primary, var(--oc-ink)); color: var(--color-background-primary, var(--oc-surface));
  font: inherit; font-size: 14px; cursor: pointer;
}
button:disabled { opacity: 0.5; }
</style>
</head>
<body>
<main id="view" hidden>
<h1 id="title"></h1>
<p id="text"></p>
<button id="open" type="button"></button>
<p class="note" id="note"></p>
</main>
<script>${script}</script>
</body>
</html>`;
}
