import { registerAppResource } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Checkouts } from "@oca/crossmint-agent-checkouts/checkouts";
import { z } from "zod";
import {
  appOnlyToolMeta,
  CARD_CREDENTIALS,
  CARD_DIAGNOSTIC_REASONS,
  CARD_PAID,
  CHECKOUT_CARD_DESCRIPTION,
  CHECKOUT_CARD_MIME_TYPE,
  CHECKOUT_CARD_URI,
  checkoutCardHtml,
  checkoutCardResourceMeta,
  localeMeta,
} from "./card.js";
import type { AppHost } from "./hosts.js";
import { type Audience, present, result, type Via } from "./moments.js";
import type { MintCardCredentials } from "./secure.js";
import {
  failure,
  messageId,
  readOnly,
  run,
  runId,
  sendAnswer,
} from "./shared.js";

export interface SecureStepOptions {
  readonly mint: MintCardCredentials;
  /** Crossmint's web origin for the configured environment. */
  readonly crossmintOrigin: string;
  /** Checkouts for checking the step the user is submitting. Without it, the server's. */
  readonly checkouts?: () => Checkouts;
}

export interface CardToolsOptions {
  readonly userId: string;
  readonly checkouts: Checkouts;
  readonly origin: string;
  readonly host: AppHost | null;
  readonly via: Via | null;
  /** The secure step, only for hosts that keep app-only tools from their model. */
  readonly secure: SecureStepOptions | null;
  /** What the card's reads tell the model to do next: the tools this server has. */
  readonly audience: Audience;
}

/**
 * The checkout card (MCP Apps) and the tools only it calls. They are
 * app-only (`ui.visibility: ["app"]`, ChatGPT `openai/visibility: private`):
 * hosts keep them from the model. Hosts without MCP Apps ignore all of it and
 * use the model tools' text and structured results.
 */
export function registerCard(
  server: McpServer,
  { userId, checkouts, origin, host, via, secure, audience }: CardToolsOptions,
) {
  const meta = checkoutCardResourceMeta(origin, {
    host,
    crossmintOrigin: secure?.crossmintOrigin ?? null,
  });
  registerAppResource(
    server,
    "Checkout card",
    CHECKOUT_CARD_URI,
    { description: CHECKOUT_CARD_DESCRIPTION, _meta: meta },
    () => ({
      contents: [
        {
          uri: CHECKOUT_CARD_URI,
          mimeType: CHECKOUT_CARD_MIME_TYPE,
          text: checkoutCardHtml(origin),
          _meta: meta,
        },
      ],
    }),
  );
  const secureStep = secure !== null;

  // The card follows its checkout through this read, progress included.
  server.registerTool(
    "card_checkout",
    {
      title: "Read the checkout",
      description: "Card only. The checkout's current state, for the card.",
      inputSchema: z.object({
        runId,
        paidFor: z
          .string()
          .min(1)
          .max(200)
          .optional()
          .describe(
            "The payment request the card showed: whether a spending limit paid it.",
          ),
      }),
      annotations: readOnly,
      _meta: appOnlyToolMeta,
    },
    ({ runId, paidFor }, ctx) =>
      run(async () => {
        const view = await checkouts.get(userId, runId, { progress: true });
        const shown = present(view, {
          via,
          audience,
          secureStep,
          meta: localeMeta(ctx.mcpReq._meta),
        });
        if (paidFor === undefined || view.pending?.requestId === paidFor) {
          return shown;
        }
        // A checkout also moves on from a payment the user declined or
        // answered with other words; only a payment's answer counts.
        const paid =
          (await checkouts.answer(userId, runId, paidFor).catch(() => null)) ===
          "payment";
        return { ...shown, _meta: { ...shown._meta, [CARD_PAID]: paid } };
      }),
  );

  // The user answered the store in the card. Doesn't wait: the card tells the
  // model, which follows the checkout with `continue`.
  server.registerTool(
    "card_answer",
    {
      title: "Answer the store",
      description:
        "Card only. Sends the answer the user gave the store's question in the card.",
      inputSchema: z.object({
        runId,
        requestId: z.string().min(1).max(200),
        answers: z
          .record(
            z.string().min(1).max(200),
            z.union([
              z.string().max(4000),
              z.number(),
              z.boolean(),
              z.array(z.string().max(500)).max(50),
            ]),
          )
          .optional(),
        instead: z.string().min(1).max(1000).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: appOnlyToolMeta,
    },
    ({ runId, requestId, answers, instead }) =>
      run(async () => {
        if ((answers === undefined) === (instead === undefined)) {
          return failure("Send either answers or instead.");
        }
        const pending = (await checkouts.get(userId, runId)).pending;
        if (pending?.requestId !== requestId || pending.kind !== "question") {
          return failure("That question is no longer open.");
        }
        await sendAnswer(
          checkouts,
          userId,
          runId,
          requestId,
          instead !== undefined
            ? { text: instead }
            : { answers: answers ?? {} },
        );
        return present(await checkouts.get(userId, runId), {
          via,
          audience,
          secureStep,
        });
      }),
  );

  // Why a card can't follow its checkout, once, so the logs show which case a
  // host is in. Also the card's probe for hosts that answer tools/call
  // without advertising it.
  server.registerTool(
    "card_diagnostics",
    {
      title: "Card diagnostics",
      description:
        "Card only. Records why the checkout card can't follow its checkout.",
      inputSchema: z.object({
        reason: z.enum(CARD_DIAGNOSTIC_REASONS),
        host: z.string().max(60).optional(),
        serverTools: z.boolean().optional(),
        openaiCallTool: z.boolean().optional(),
        runId: z.string().max(200).optional(),
        /** frame-kept-height: the height the card reported, and the frame's a moment later. */
        reported: z.number().int().min(0).max(20_000).optional(),
        frame: z.number().int().min(0).max(20_000).optional(),
        openaiHeight: z.boolean().optional(),
      }),
      annotations: readOnly,
      _meta: appOnlyToolMeta,
    },
    (input) => {
      // Only plain words reach the log: no values the card could smuggle in.
      const plainText = (value: string | undefined, max: number) =>
        value?.replace(/[^\w .:/-]/g, "").slice(0, max) || null;
      console.info("Checkout card can't follow its checkout", {
        reason: input.reason,
        host,
        hostName: plainText(input.host, 60),
        serverTools: input.serverTools ?? null,
        openaiCallTool: input.openaiCallTool ?? null,
        runId: plainText(input.runId, 80),
        ...(input.reported !== undefined
          ? {
              reported: input.reported,
              frame: input.frame ?? null,
              openaiHeight: input.openaiHeight ?? null,
            }
          : {}),
      });
      return result({ noted: true });
    },
  );

  if (secure) {
    registerSecureStep(server, { userId, checkouts, via, secure, audience });
  }
}

const protectedInput = z.object({
  protectedInputId: z.string().min(1).max(200),
});
const secureAnswer = z.union([
  z.string().max(4000),
  z.number(),
  z.boolean(),
  z.array(z.string().max(500)).max(50),
  protectedInput,
]);

/** Only a plain https origin is worth logging (it is what Crossmint must allow). */
function loggableOrigin(value: string | undefined) {
  return value && /^https:\/\/[a-z0-9.-]{1,253}$/.test(value) ? value : null;
}

/**
 * The card's secure step: Crossmint's protected inputs rendered inside the
 * card. The model never sees credentials or protected values.
 */
function registerSecureStep(
  server: McpServer,
  {
    userId,
    checkouts,
    via,
    secure,
    audience,
  }: {
    userId: string;
    checkouts: Checkouts;
    via: Via | null;
    secure: SecureStepOptions;
    audience: Audience;
  },
) {
  const fallback =
    "The secure step can't open in the card. The user can finish it at pending.actionUrl.";

  /** Reads the step the user is submitting. */
  const reader = () => secure.checkouts?.() ?? checkouts;

  async function open(runId: string, requestId: string) {
    const pending = (await reader().get(userId, runId)).pending;
    return pending?.requestId === requestId && pending.kind === "protected"
      ? pending
      : null;
  }

  server.registerTool(
    "card_secure_session",
    {
      title: "Open the secure step in the card",
      description:
        "Card only. Short-lived credentials for Crossmint's secure form in the checkout card.",
      inputSchema: z.object({
        runId,
        requestId: z.string().min(1).max(200),
        origin: z.string().max(300).optional(),
      }),
      annotations: readOnly,
      _meta: appOnlyToolMeta,
    },
    ({ runId, requestId, origin }) =>
      run(async () => {
        const pending = (await checkouts.get(userId, runId)).pending;
        if (pending?.requestId !== requestId || pending.kind !== "protected") {
          return failure("No secure step is open for this checkout.");
        }
        // The card's own origin is what Crossmint's client key must allow.
        const from = loggableOrigin(origin);
        if (from) {
          console.info(`Card secure step requested from ${from}`);
        }
        const credentials = await secure.mint(userId);
        if (!credentials) {
          return failure(fallback);
        }
        return {
          content: [{ type: "text" as const, text: "Secure step ready." }],
          structuredContent: { ready: true, requestId },
          // Only what Crossmint's protected inputs need: not the user's email.
          _meta: {
            [CARD_CREDENTIALS]: {
              apiKey: credentials.apiKey,
              jwt: credentials.jwt,
              expiresAt: credentials.expiresAt,
            },
          },
        };
      }),
  );

  server.registerTool(
    "card_submit_secure_answers",
    {
      title: "Send the secure answers",
      description:
        "Card only. Sends the store's form with Crossmint protected-input references for private fields.",
      inputSchema: z.object({
        runId,
        requestId: z.string().min(1).max(200),
        answers: z.record(z.string().min(1).max(200), secureAnswer),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: appOnlyToolMeta,
    },
    ({ runId, requestId, answers }) =>
      run(async () => {
        const pending = await open(runId, requestId);
        if (!pending) {
          return failure("That form is no longer open.");
        }
        const fields = new Map(pending.fields.map((item) => [item.key, item]));
        for (const [key, value] of Object.entries(answers)) {
          const field = fields.get(key);
          const isReference = protectedInput.safeParse(value).success;
          if (!field || (field.handling === "protected") !== isReference) {
            return failure(`The answer for "${key}" doesn't fit the form.`);
          }
        }
        for (const field of pending.fields) {
          if (field.required && !(field.key in answers)) {
            return failure(`"${field.label}" is required.`);
          }
        }
        await checkouts.respond(
          userId,
          runId,
          messageId([userId, runId, requestId, answers]),
          { requestId, answers },
        );
        return present(await checkouts.get(userId, runId), {
          via,
          audience,
          secureStep: true,
        });
      }),
  );
}
