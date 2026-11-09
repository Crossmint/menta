/**
 * The user's delivery addresses (Crossmint buyer profiles) for the model:
 * read them before a delivery, save one the user gave in chat, delete one,
 * and set the default. The same addresses as /addresses on Menta, and the
 * same helpers as the web chat's tools (address-chat).
 */

import type { McpServer } from "@modelcontextprotocol/server";
import {
  addressGuide,
  deleteDescription,
  deleteFromChat,
  deleteInput,
  isProblem,
  listDescription,
  saveDescription,
  saveFromChat,
  saveInput,
  setDefaultDescription,
  setDefaultFromChat,
  setDefaultInput,
  type ToolNames,
} from "@oca/crossmint-agent-checkouts/address-chat";
import type { Checkouts } from "@oca/crossmint-agent-checkouts/checkouts";
import { z } from "zod";
import { toolStatusMeta } from "./card.js";
import { result } from "./moments.js";
import type { UserProfile } from "./server.js";
import { failure, readOnly, run } from "./shared.js";

export interface AddressToolsOptions {
  readonly userId: string;
  readonly checkouts: Checkouts;
  /** The signed-in user's email, for an address saved without one. */
  readonly profile: ((userId: string) => Promise<UserProfile | null>) | null;
}

export const ADDRESS_TOOLS: ToolNames = {
  list: "delivery_addresses",
  save: "save_delivery_address",
  setDefault: "set_default_delivery_address",
  start: "start",
};

/** A helper's answer as a tool result: a problem to fix, or what happened. */
function answer(value: object) {
  return isProblem(value)
    ? failure(value.problem)
    : result(value as Record<string, unknown>);
}

export function registerAddressTools(
  server: McpServer,
  { userId, checkouts, profile }: AddressToolsOptions,
) {
  const tools = ADDRESS_TOOLS;

  server.registerTool(
    tools.list,
    {
      title: "Delivery addresses",
      description: listDescription,
      inputSchema: z.object({}),
      annotations: readOnly,
      _meta: toolStatusMeta("Checking your addresses…", "Addresses"),
    },
    () =>
      run(async () =>
        result(addressGuide(await checkouts.addresses(userId), tools)),
      ),
  );

  server.registerTool(
    tools.save,
    {
      title: "Save a delivery address",
      description: saveDescription(tools),
      inputSchema: saveInput(tools),
      annotations: {
        readOnlyHint: false,
        // With an id it overwrites a saved address.
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: toolStatusMeta("Saving the address…", "Address saved"),
    },
    (input) =>
      run(async () =>
        answer(
          await saveFromChat(checkouts, userId, input, tools, async () =>
            profile ? ((await profile(userId))?.email ?? null) : null,
          ),
        ),
      ),
  );

  server.registerTool(
    "delete_delivery_address",
    {
      title: "Delete a delivery address",
      description: deleteDescription,
      inputSchema: deleteInput(tools),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: toolStatusMeta("Deleting the address…", "Address deleted"),
    },
    ({ id }) =>
      run(async () =>
        answer(await deleteFromChat(checkouts, userId, id, tools)),
      ),
  );

  server.registerTool(
    tools.setDefault,
    {
      title: "Set the default address",
      description: setDefaultDescription,
      inputSchema: setDefaultInput(tools),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: toolStatusMeta("Setting the default…", "Default set"),
    },
    ({ id }) =>
      run(async () =>
        result(await setDefaultFromChat(checkouts, userId, id, tools)),
      ),
  );
}
