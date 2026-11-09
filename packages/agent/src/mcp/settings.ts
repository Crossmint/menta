/**
 * Plugin settings: our Settings page inside a host's plugin settings
 * (OpenAI MCP Extensions, "Structured Settings"), drawn by ChatGPT. ChatGPT
 * no longer gets it (it reaches cards and addresses through `manage`'s
 * links); only the local dev host does, so the code stays tested. The capability names a
 * read tool and an update tool; ChatGPT draws native controls from the read
 * result and calls the update tool with only the changed values. Layout
 * buttons call same-server tools with `{}`: an MCP App tool opens its view in
 * a modal over settings, a regular tool shows its result text as a tooltip.
 *
 * Same sections, labels and copy as Settings:
 * - "Cards · saved by Crossmint": "Manage cards" opens /wallet#cards.
 * - "Addresses": the default ("Default for my deliveries"), as a choice of
 *   saved labels or "None", and "Add an address" (opens the add form on
 *   Settings). Labels only: never profile IDs, streets or names.
 * - "Store sign-ins": "Sign out of all stores", the same call as
 *   DELETE /api/store-sign-ins.
 *
 * Layout buttons are plain tools: no `openai/ui` settings entrypoint, which
 * OpenAI removed (mcp-extensions 0.2.0); ChatGPT drew no button for tools
 * that still declared one.
 *
 * Every tool here is registered only for hosts that enforce app-only tools
 * (see `offersSettings`). The read, update and sign-out tools are app-only
 * (hidden from the model), because only the user sets the default address and
 * signs out of stores; the two link tools are not (see `linkTool`).
 */

import { registerAppResource } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import type {
  Checkouts,
  SavedAddress,
} from "@oca/crossmint-agent-checkouts/checkouts";
import { z } from "zod";
import {
  ACCOUNT_VIEW_DESCRIPTION,
  ACCOUNT_VIEW_MIME_TYPE,
  ACCOUNT_VIEW_URI,
  type AccountSection,
  accountUrl,
  accountViewHtml,
  accountViewResourceMeta,
} from "./account-view.js";
import { appOnlyToolMeta, toolStatusMeta } from "./card.js";
import type { AppHost } from "./hosts.js";

export const SETTINGS_CAPABILITY = "openai/settings";
export const SETTINGS_READ_TOOL = "settings_read";
export const SETTINGS_UPDATE_TOOL = "settings_update";
export const MANAGE_CARDS_TOOL = "settings_manage_cards";
export const ADD_ADDRESS_TOOL = "settings_add_address";
export const SIGN_OUT_STORES_TOOL = "settings_sign_out_stores";

/**
 * Hosts that get plugin settings: only the local dev host. ChatGPT renders
 * them and keeps app-only tools from its model, but no longer gets them, as
 * it no longer gets the checkout card; Claude doesn't render them.
 */
export function offersSettings(host: AppHost | null) {
  return host === "local";
}

/** The Settings copy, one place for the settings page and its views. */
export const copy = {
  cards: {
    group: "Cards · saved by Crossmint",
    action: "Manage cards",
    text: "Assistants see only the brand and last 4 digits. You approve every spending limit.",
    view: "Add or change cards on Menta, in Crossmint's secure form. Assistants see only the brand and last 4 digits. You approve every spending limit.",
  },
  addresses: {
    group: "Addresses",
    action: "Add an address",
    text: "Add where orders should be delivered. Checkouts fill it in for you.",
    view: "Add where orders should be delivered. Checkouts fill it in for you. Card details are never stored here.",
    defaultTitle: "Default for my deliveries",
    defaultText:
      "Deliveries go to your default unless you name another, like “send it to Work”.",
  },
  signIns: {
    group: "Store sign-ins",
    action: "Sign out of all stores",
    saved:
      "Stores remember you between checkouts. Checkouts reuse the sign-ins and cookies from earlier checkouts.",
    none: "No saved store sign-ins. If you sign in to a store during a checkout, the next checkout stays signed in.",
    unknown:
      "If you sign in to a store during a checkout, the next checkout stays signed in.",
    cleared: "Signed out of all stores. The next checkout starts fresh.",
    nothing: "No saved store sign-ins.",
  },
} as const;

/** What "no default" is called: "None", unless an address is labelled that. */
export function noDefaultOption(labels: readonly string[]) {
  const taken = new Set(labels.map((label) => label.trim().toLowerCase()));
  return (
    ["None", "No default", "(none)"].find(
      (option) => !taken.has(option.toLowerCase()),
    ) ?? "(none)"
  );
}

type AddressChoice = Pick<SavedAddress, "label" | "isDefault">;

/** The default-address setting: saved labels (each once) plus the no-default option. */
export function defaultAddressSetting(addresses: readonly AddressChoice[]) {
  const labels = [...new Set(addresses.map((address) => address.label))];
  const none = noDefaultOption(labels);
  return {
    options: [...labels, none],
    none,
    value: addresses.find((address) => address.isDefault)?.label ?? none,
  };
}

/** The read tool's result (`SettingsReadResult`). */
export function settingsReadResult(
  addresses: readonly AddressChoice[],
  signedIn: boolean | null,
) {
  const setting = defaultAddressSetting(addresses);
  return {
    schema: {
      type: "object" as const,
      properties: {
        defaultAddress: {
          type: "string" as const,
          title: copy.addresses.defaultTitle,
          description: copy.addresses.defaultText,
          enum: setting.options,
        },
      },
      required: ["defaultAddress"],
    },
    values: { defaultAddress: setting.value },
    layout: [
      {
        kind: "group" as const,
        title: copy.cards.group,
        items: [
          {
            kind: "tool" as const,
            tool: MANAGE_CARDS_TOOL,
            title: copy.cards.action,
            description: copy.cards.text,
          },
        ],
      },
      {
        kind: "group" as const,
        title: copy.addresses.group,
        items: [
          { kind: "property" as const, property: "defaultAddress" },
          {
            kind: "tool" as const,
            tool: ADD_ADDRESS_TOOL,
            title: copy.addresses.action,
            description: copy.addresses.text,
          },
        ],
      },
      {
        kind: "group" as const,
        title: copy.signIns.group,
        items: [
          {
            kind: "tool" as const,
            tool: SIGN_OUT_STORES_TOOL,
            title: copy.signIns.action,
            description:
              signedIn === null
                ? copy.signIns.unknown
                : signedIn
                  ? copy.signIns.saved
                  : copy.signIns.none,
          },
        ],
      },
    ],
  };
}

/** The read tool's `outputSchema`, as the spec's example declares it. */
const readOutput = z.object({
  schema: z.looseObject({
    type: z.literal("object"),
    properties: z.record(z.string(), z.unknown()),
    required: z.array(z.string()).optional(),
  }),
  values: z.record(z.string(), z.unknown()),
  layout: z.array(z.record(z.string(), z.unknown())).optional(),
});

const updateOutput = z.object({
  values: z.object({ defaultAddress: z.string() }),
});

function failure(message: string) {
  console.warn("MCP settings call failed", { message });
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

/** Crossmint's own short messages are safe to show; anything else stays generic. */
function message(error: unknown, fallback: string) {
  return error instanceof Error && error.name === "CheckoutError"
    ? error.message
    : fallback;
}

/** An app-only tool's metadata (hidden from the model, callable by the host and views). */
function settingsToolMeta(invoking: string, invoked: string) {
  return { ...appOnlyToolMeta, ...toolStatusMeta(invoking, invoked) };
}

export interface SettingsOptions {
  /** The verified Crossmint user (Stytch user ID). Never taken from tool input. */
  readonly userId: string;
  readonly checkouts: Checkouts;
  readonly origin: string;
}

/**
 * Registers the settings capability (`extensions` for 2026-07-28's
 * `server/discover` and 2025-11-25's `initialize`, plus the legacy
 * `experimental` key), its tools and the account view. Call before the server
 * connects (createCommerceServer does).
 */
export function registerSettings(
  server: McpServer,
  { userId, checkouts, origin }: SettingsOptions,
) {
  const capability = {
    readTool: SETTINGS_READ_TOOL,
    updateTool: SETTINGS_UPDATE_TOOL,
  };
  server.server.registerCapabilities({
    extensions: { [SETTINGS_CAPABILITY]: capability },
    experimental: { [SETTINGS_CAPABILITY]: capability },
  });

  server.registerTool(
    SETTINGS_READ_TOOL,
    {
      title: "Menta settings",
      description:
        "Settings only. The user's Menta settings: default delivery address (by label), cards, addresses and store sign-ins.",
      inputSchema: z.strictObject({}),
      outputSchema: readOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: settingsToolMeta("Loading settings…", "Settings loaded"),
    },
    async () => {
      try {
        const [addresses, signedIn] = await Promise.all([
          checkouts.addresses(userId),
          checkouts.hasSavedSignIns(userId).catch(() => null),
        ]);
        return {
          content: [],
          structuredContent: settingsReadResult(addresses, signedIn),
        };
      } catch (error) {
        return failure(
          message(error, "Couldn't load your addresses. Try again."),
        );
      }
    },
  );

  server.registerTool(
    SETTINGS_UPDATE_TOOL,
    {
      title: "Save Menta settings",
      description:
        "Settings only. Sets the default delivery address by its saved label, or none.",
      inputSchema: z.strictObject({
        set: z.strictObject({
          defaultAddress: z.string().min(1).max(200),
        }),
      }),
      outputSchema: updateOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: settingsToolMeta("Saving…", "Saved"),
    },
    async ({ set }) => {
      try {
        const addresses = await checkouts.addresses(userId);
        const { none } = defaultAddressSetting(addresses);
        const wanted = set.defaultAddress;
        if (wanted === none) {
          const current = addresses.find((address) => address.isDefault);
          if (current) {
            await checkouts.setDefaultAddress(userId, current.id, false);
          }
        } else {
          const matches = addresses.filter(
            (address) => address.label === wanted,
          );
          if (matches.length !== 1 || !matches[0]) {
            return failure(
              matches.length === 0
                ? `There's no saved address labelled “${wanted}”. Reload settings to see your addresses.`
                : `More than one address is labelled “${wanted}”. Rename one on Menta first.`,
            );
          }
          await checkouts.setDefaultAddress(userId, matches[0].id, true);
        }
        return {
          content: [
            {
              type: "text" as const,
              text:
                wanted === none
                  ? "No default address."
                  : `Default for my deliveries: ${wanted}.`,
            },
          ],
          structuredContent: { values: { defaultAddress: wanted } },
        };
      } catch (error) {
        return failure(
          message(error, "Couldn't change the default. Try again."),
        );
      }
    },
  );

  // The settings buttons. "Manage cards" and "Add an address" are MCP App
  // tools whose view opens the Settings section; the card form itself stays
  // on Menta (Crossmint's iframe), never inside the host's settings.
  const viewMeta = accountViewResourceMeta(origin);
  registerAppResource(
    server,
    "Menta account",
    ACCOUNT_VIEW_URI,
    { description: ACCOUNT_VIEW_DESCRIPTION, _meta: viewMeta },
    () => ({
      contents: [
        {
          uri: ACCOUNT_VIEW_URI,
          mimeType: ACCOUNT_VIEW_MIME_TYPE,
          text: accountViewHtml(origin),
          _meta: viewMeta,
        },
      ],
    }),
  );

  function linkTool(
    name: string,
    section: AccountSection,
    content: { group: string; action: string; view: string },
    status: [string, string],
  ) {
    server.registerTool(
      name,
      {
        title: content.action,
        description: `For Menta settings only; in chat use manage or delivery_addresses instead. Opens the user's Menta account: ${content.action.toLowerCase()}.`,
        inputSchema: z.strictObject({}),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        // Not app-only: ChatGPT won't render a private tool's widget in
        // settings. They only link to /settings, so a model call is harmless.
        _meta: {
          ...toolStatusMeta(...status),
          "openai/widgetAccessible": true,
          ui: { resourceUri: ACCOUNT_VIEW_URI },
          "ui/resourceUri": ACCOUNT_VIEW_URI,
          "openai/outputTemplate": ACCOUNT_VIEW_URI,
        },
      },
      () => {
        const url = accountUrl(origin, section);
        return {
          content: [
            {
              type: "text" as const,
              text: `${content.action} on Menta: ${url}`,
            },
          ],
          structuredContent: {
            section,
            title: content.group,
            text: content.view,
            action: content.action,
            url,
          },
        };
      },
    );
  }
  linkTool(MANAGE_CARDS_TOOL, "cards", copy.cards, ["Opening cards…", "Cards"]);
  linkTool(ADD_ADDRESS_TOOL, "add-address", copy.addresses, [
    "Opening addresses…",
    "Addresses",
  ]);

  server.registerTool(
    SIGN_OUT_STORES_TOOL,
    {
      title: copy.signIns.action,
      description:
        "Settings only. Signs the user out of every store their checkouts signed in to (Crossmint erases their browser profile).",
      inputSchema: z.strictObject({}),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: {
        ...settingsToolMeta("Signing out…", "Signed out"),
      },
    },
    async () => {
      try {
        const saved = await checkouts.hasSavedSignIns(userId);
        if (!saved) {
          return {
            content: [{ type: "text" as const, text: copy.signIns.nothing }],
          };
        }
        await checkouts.clearSignIns(userId);
        return {
          content: [{ type: "text" as const, text: copy.signIns.cleared }],
        };
      } catch (error) {
        return failure(
          message(error, "Couldn't update store sign-ins. Try again."),
        );
      }
    },
  );
}
