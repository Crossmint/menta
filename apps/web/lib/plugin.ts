/**
 * The installable Menta plugin (plugins/menta) for ChatGPT,
 * Codex and Claude: everything in it that comes from elsewhere, so it can't
 * drift. The MCP server URL is the production origin's /mcp, the icon is
 * the brand's mascot (brand.ts), and the buy skill is the MCP server's own
 * instructions. `pnpm plugin:sync` writes these files; plugin.unit.test.ts
 * fails when they're stale. Hand-written there: skills/setup/SKILL.md (the
 * onboarding skill) and README.md.
 *
 * Formats, from primary sources (docs/HOSTS.md §7):
 * - OpenAI (ChatGPT, Codex): portable Agent Plugins `plugin.json` and
 *   `mcp.json` at the root, OpenAI presentation and the onboarding skill
 *   under `extensions["com.openai"]` with the directory review cases
 *   (developers.openai.com/plugins/deploy/submission). No `apps` or
 *   `.app.json`: submitted packages can't contain them; the dashboard ties
 *   the MCP server to the listing.
 * - Claude (Claude Code, claude.ai, Cowork): `.claude-plugin/plugin.json`
 *   and `.mcp.json` (claude.com/docs/plugins/build). Same skills folder.
 * - Cursor and Grok Bot (Cursor Marketplace): `.cursor-plugin/plugin.json`
 *   (cursor.com/docs/reference/plugins), plus the repo-root
 *   `.cursor-plugin/marketplace.json` that points at this package.
 */

import { BRAND_NAME } from "./brand";
import { LEGAL, PRODUCTION_ORIGIN } from "./site";

export const PLUGIN_NAME = "menta";
export const PLUGIN_VERSION = "0.1.0";
/** The MCP server the plugin connects to: the same URL people add by hand. */
export const PLUGIN_MCP_URL = `${PRODUCTION_ORIGIN}/mcp`;

/** The MCP server's own description (packages/agent/src/mcp/server.ts serverInfo). */
const DESCRIPTION =
  "Buys, orders, books, returns and cancels things at online stores for you, through Crossmint checkouts. You approve every spending limit yourself; the assistant never can.";

const author = {
  name: "Crossmint",
  url: "https://www.crossmint.com",
};

const longDescription =
  "Menta does things at online stores for you: buy, order, book, return, cancel a subscription, reorder. Tell the assistant what you want and where; it starts a Crossmint checkout, a browser agent that works through the store and never spends above your limit. You answer the store's questions when it needs you. It pays only from spending limits you approve yourself in Crossmint's secure form: when one covers the total, Menta pays from it and tells you; otherwise you approve one. The assistant can never approve a spending limit, and card details never pass through the chat. Some stores block automated browsers.";

/**
 * What ChatGPT's directory reviewers run: exactly five cases that should use
 * Menta and three that shouldn't. Reviewers stop at the payment approval
 * and cancel; nothing in review needs a real payment. `tools_triggered` is
 * one comma-separated string: the upload rejects arrays.
 */
const review = {
  test_cases: {
    positive: [
      {
        description: "Start a purchase with a spending limit",
        prompt: "Buy a 4-pack of AA batteries on Amazon, under $15.",
        tools_triggered: "start",
        expected_behavior:
          "Starts a checkout capped at $15; the checkout card shows when the store needs the user. At payment, if none of the user's spending limits covers it, the card asks the user to approve one in Crossmint's secure form; the assistant never approves it. A reviewer account without spending limits can cancel instead of paying.",
      },
      {
        description: "Answer the store's questions",
        prompt: "Order a Harvest Bowl from Sweetgreen for pickup at 12:30.",
        tools_triggered: "start, continue",
        expected_behavior:
          "Starts a pickup order. When the store asks something (such as the pickup location), a step card shows the store's own options; the user answers in the card or in chat and the checkout continues.",
      },
      {
        description: "Check on an order",
        prompt: "Where is my last order?",
        tools_triggered: "history",
        expected_behavior:
          "Reports the status of the user's most recent checkout and, for a placed order, the receipt total and store order number exactly as returned.",
      },
      {
        description: "Cancel a checkout",
        prompt: "Cancel my Amazon checkout.",
        tools_triggered: "history, cancel",
        expected_behavior:
          "Finds the open checkout and cancels it, and says nothing was charged.",
      },
      {
        description: "Set up delivery and payment",
        prompt: "Set up Menta.",
        tools_triggered: "manage",
        expected_behavior:
          "Gives the Menta links for adding a card (in Crossmint's secure form) and delivery addresses. It never asks for card details in chat.",
      },
    ],
    negative: [
      {
        description: "General knowledge question",
        prompt: "What's the capital of Australia?",
      },
      {
        description: "Sending money to a person",
        prompt: "Send $50 to my friend on Venmo.",
      },
      {
        description: "Product research without buying",
        prompt: "Compare the battery life of the latest iPhone and Pixel.",
      },
    ],
  },
  commerce: true,
  commerce_description:
    "Menta buys physical goods and orders (household items, groceries, food for pickup or delivery) from online stores on the user's behalf through Crossmint Agent Checkouts. Payments come only from spending limits the user approves in Crossmint's secure form, on Menta's own domain or in Menta's card: when one covers a checkout's total, Menta pays from it and says so; otherwise the user approves one. The model can never approve a spending limit, and card details never pass through the chat. There's no ChatGPT-specific fee or surcharge.",
};

/** The portable manifest, with ChatGPT/Codex presentation and onboarding. */
export function openAiManifest() {
  return {
    $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    description: DESCRIPTION,
    author,
    homepage: PRODUCTION_ORIGIN,
    license: "Apache-2.0",
    keywords: ["shopping", "checkout", "crossmint", "commerce", "orders"],
    extensions: {
      "com.openai": {
        interface: {
          displayName: BRAND_NAME,
          shortDescription: "Buys things online for you",
          longDescription,
          developerName: "Crossmint",
          // OpenAI has no Shopping category; its list starts at Productivity.
          category: "Productivity",
          capabilities: ["Interactive", "Read", "Write"],
          websiteURL: PRODUCTION_ORIGIN,
          supportURL: `${PRODUCTION_ORIGIN}/help#contact`,
          privacyPolicyURL: `${PRODUCTION_ORIGIN}${LEGAL.privacy}`,
          termsOfServiceURL: `${PRODUCTION_ORIGIN}${LEGAL.terms}`,
          defaultPrompt: [
            "Buy a 4-pack of AA batteries on Amazon, under $15.",
            "Order a Harvest Bowl from Sweetgreen for pickup at 12:30.",
            "Where is my last order?",
          ],
          brandColor: "#10b45e",
          brandColorDark: "#3dd64f",
          composerIcon: "./assets/logo.png",
          composerIconDark: "./assets/logo.png",
          logo: "./assets/logo.png",
        },
        onboardingSkill: "./skills/setup/SKILL.md",
        review,
        publication: { release_notes: "First release." },
      },
    },
  };
}

/** Portable MCP servers (ChatGPT, Codex). */
export function openAiMcp() {
  return {
    $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
    mcpServers: {
      [PLUGIN_NAME]: { type: "streamable-http", url: PLUGIN_MCP_URL },
    },
  };
}

/** Claude's manifest (.claude-plugin/plugin.json). */
export function claudeManifest() {
  return {
    name: PLUGIN_NAME,
    displayName: BRAND_NAME,
    version: PLUGIN_VERSION,
    description: DESCRIPTION,
    author,
    homepage: PRODUCTION_ORIGIN,
    license: "Apache-2.0",
    keywords: ["shopping", "checkout", "crossmint", "commerce", "orders"],
  };
}

/** Claude's MCP servers (.mcp.json). */
export function claudeMcp() {
  return {
    mcpServers: { [PLUGIN_NAME]: { type: "http", url: PLUGIN_MCP_URL } },
  };
}

/**
 * Cursor's manifest (.cursor-plugin/plugin.json; cursor.com/docs/reference/plugins),
 * which Cursor reads before the portable one. The Cursor Marketplace is also
 * where Grok Bot installs plugins from. The MCP server is inline with only
 * its URL: Cursor infers the transport from `url`, and its docs don't list
 * the portable `type: "streamable-http"`.
 */
export function cursorManifest() {
  return {
    name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    description: DESCRIPTION,
    author: { name: author.name },
    homepage: PRODUCTION_ORIGIN,
    license: "Apache-2.0",
    keywords: ["shopping", "checkout", "crossmint", "commerce", "orders"],
    logo: "assets/logo.png",
    skills: "skills/",
    mcpServers: { [PLUGIN_NAME]: { url: PLUGIN_MCP_URL } },
  };
}

/**
 * The repository's Cursor marketplace (.cursor-plugin/marketplace.json at the
 * repo root), which points the Marketplace at this package. Hand-placed
 * there; plugin.unit.test.ts checks it matches.
 */
export function cursorMarketplace() {
  return {
    name: PLUGIN_NAME,
    owner: { name: author.name },
    metadata: { description: `${BRAND_NAME}, from this repository.` },
    plugins: [
      {
        name: PLUGIN_NAME,
        source: "plugins/menta",
        description: DESCRIPTION,
      },
    ],
  };
}

/** The buy skill: the MCP server's own instructions, verbatim. */
export function buySkill(instructions: string) {
  return `---
name: buy
description: Do something at an online store or service for the user with Menta (buy, order, book, reserve, return, cancel a subscription, reorder, sign in to their account there), or check on, answer or cancel one of their checkouts. Use when the user asks to buy or order something, book or reserve something, return an order, cancel a subscription, sign in or log in to a store, or asks about a Menta checkout or order.
---

<!-- Generated from the Menta MCP server's instructions by \`pnpm plugin:sync\`. Edit them in packages/agent/src/mcp/server.ts. -->

# Buy with Menta

${instructions.trim()}
`;
}

/**
 * JSON files are compared parsed (Biome formats them); the logo as bytes (the
 * icon, public/brand/icon.png, which the caller reads); the rest as text.
 */
export function pluginFiles(instructions: string, logo: Uint8Array) {
  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
  return {
    "plugin.json": json(openAiManifest()),
    "mcp.json": json(openAiMcp()),
    ".claude-plugin/plugin.json": json(claudeManifest()),
    ".mcp.json": json(claudeMcp()),
    ".cursor-plugin/plugin.json": json(cursorManifest()),
    "assets/logo.png": logo,
    "skills/buy/SKILL.md": buySkill(instructions),
  } as const;
}
