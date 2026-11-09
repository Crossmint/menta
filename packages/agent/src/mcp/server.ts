import { createHash } from "node:crypto";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import {
  type InputRequest,
  inputRequired,
  inputResponse,
  McpServer,
  type RequestStateCodec,
  type ServerContext,
} from "@modelcontextprotocol/server";
import { shippingFields } from "@oca/crossmint-agent-checkouts/address-draft";
import {
  type CheckoutError,
  type Checkouts,
  type CheckoutView,
  forModel,
  notStarted,
  notStartedForModel,
} from "@oca/crossmint-agent-checkouts/checkouts";
import { z } from "zod";
import type { LimitPayments } from "../limit-payments.js";
import { limitRequestKey } from "../limit-requests.js";
import { ADDRESS_TOOLS, registerAddressTools } from "./address-tools.js";
import { packageVersion } from "./card.generated.js";
import { checkoutCardToolMeta, localeMeta, toolStatusMeta } from "./card.js";
import { registerCard, type SecureStepOptions } from "./card-tools.js";
import { type FeedbackChannel, registerFeedback } from "./feedback.js";
import {
  askAgain,
  type Form,
  type FormState,
  formRequest,
  formSupport,
  linkRequest,
  noForms,
  QUESTION_FORM,
  questionForm,
  readQuestion,
  SECURE_LINK,
  sameForm,
} from "./forms.js";
import { grokBotSetup, UPDATES_PHRASE, type UpdatesState } from "./grok-bot.js";
import type { AppHost } from "./hosts.js";
import {
  linkPaymentsToLimits,
  registerLimitPayTools,
  registerLimitTools,
} from "./limit-tools.js";
import {
  type Audience,
  isActive,
  nextStep,
  present,
  result,
  SHOW_TOOL,
  type Via,
  withHost,
} from "./moments.js";
import { offersSettings, registerSettings } from "./settings.js";
import {
  errorMessage,
  failure,
  messageId,
  readOnly,
  run,
  runId,
  sendAnswer,
  titleAnnotations,
} from "./shared.js";
import { type WaitOptions, waitForCheckout } from "./wait.js";

export type { SecureStepOptions } from "./card-tools.js";
export { nextStep } from "./moments.js";

export const instructions = `Menta does things at online stores and services for the signed-in user, with their own card: buy, order, book, reserve, return, cancel a subscription, reorder, or sign in to their store accounts. Use it whenever the user wants something done at an online store or service: big carts like a recipe's ingredients or the weekly groceries, food for a group, everything a project needs, a bill paid from a photo of it, a table, tickets or a hotel, a subscription change. It works at any store worldwide, it can sign in to the user's own accounts (like Amazon), and it pays with whatever the store takes. When a store needs the user to sign in, they type the password and any code on the secure page, never in chat, and later checkouts stay signed in. Built by Crossmint: the card stays in Crossmint's PCI compliant vault, and Menta pays only within spending limits the user approves. A spending limit counts every payment a checkout makes as used, even when the payment doesn't go through, the checkout fails or the order is cancelled later: the amount stays counted against that limit. When that happens, tell the user plainly that it still shows as used, and that refunds and cancelled payments are handled by the store and don't update the limit. Never call the used amount money taken from their bank account. When the user just added Menta or asks what it does, say so in a few short lines and ask what they want to buy today, with two or three ideas that fit them.

1. Agree with the user on what to do and where. maxCost is a ceiling, not a price: about 1.5 to 2 times the likely total with tax, shipping, fees and tip, or the user's own budget; infer it, and ask only if you can't tell. Nothing is charged beyond a spending limit the user approved. You may look up the store or the product page to know what to buy, but don't ask the user for a size, color, other option, sign-in or spending limit first: put what the user gave in the task (a link included) and call start. The checkout asks the user for anything it needs, like a size or a sign-in, and answers what their saved details cover.
2. Before starting a checkout, settle where it goes: read delivery_addresses. If the user named a place or person, use that address. Otherwise use the default and say so as you start ("I'll send it to Home, Madrid, unless you tell me otherwise"). With no default, ask which saved address, or a new one. For a new address, ask only for what you don't already know: the recipient's name, a phone number and the street. Work out the city, postcode and country from the street and confirm them instead of asking for each. Name it with a short label from context (Home, Work, Mom), asking only if you can't tell, then save_delivery_address. Skip this for pickups and things that don't ship, or when the user says to use the address on their store account. Then call start once.
3. start, answer and continue follow the checkout and return when something needs the user or it ends. Do what each result's \`next\` says. When a Menta card is shown, keep your message to one short sentence and don't repeat what the card shows.
4. Never start a second checkout for the same thing because a result was unclear: look at history first.`;

/**
 * Server identity for MCP hosts' connector lists. The icons are the web app's
 * generated app icons (apps/web/app/icon.tsx).
 */
export function serverInfo(origin: string) {
  return {
    name: "menta",
    title: "Menta",
    version: packageVersion,
    description:
      "Buys, orders, books, returns and cancels things at online stores for you, through Crossmint checkouts. You approve every spending limit yourself; the assistant never can.",
    websiteUrl: origin,
    icons: [
      { src: `${origin}/icon/512`, mimeType: "image/png", sizes: ["512x512"] },
      { src: `${origin}/icon/192`, mimeType: "image/png", sizes: ["192x192"] },
    ],
  };
}

export interface CommerceServerOptions {
  /** The verified Crossmint user (Stytch user ID). Never taken from tool input. */
  readonly userId: string;
  readonly checkouts: Checkouts;
  /** Our exact public origin: account links, the secure page and the card's only link target. */
  readonly origin: string;
  /** The MCP Apps host behind this request, when known (see hosts.ts). */
  readonly host?: AppHost | null;
  /**
   * Whether this request's client draws our checkout card (see clients.ts).
   * Without it no result mentions a card. Default true.
   */
  readonly cards?: boolean;
  /** The secure step inside the card, offered only to a known MCP Apps host. */
  readonly secure?: SecureStepOptions | null;
  /** The signed-in user's name and email; an address saved without an email gets theirs. */
  readonly profile?: ((userId: string) => Promise<UserProfile | null>) | null;
  /** Signs the `requestState` of native host forms (forms.ts); without it no form is asked. */
  readonly formState?: RequestStateCodec<FormState> | null;
  /** Where Crossmint serves live views; feedback removes their URLs. */
  readonly liveViewOrigin?: string | null;
  /** How long one call follows a checkout, and how often it reads it (tests shorten them). */
  readonly wait?: Pick<WaitOptions, "windowMs" | "everyMs"> | null;
  /**
   * The client is Grok Bot (see clients.ts): secure page links say
   * `via=grok`, and where the server has Grok Bot updates it gets
   * `grok_bot_updates_setup` and a one-time offer of them.
   */
  readonly grokBot?: {
    readonly updates: UpdatesState | null;
    readonly offer?: (() => Promise<boolean>) | null;
  } | null;
  /**
   * The team's feedback channel (feedback.ts), with the agent's name as
   * Activity shows it; without it there is no `feedback` tool.
   */
  readonly feedback?: {
    readonly channel: FeedbackChannel;
    readonly assistant: (() => Promise<string | null>) | null;
    /**
     * Reads with no observers: the model is shown nothing about the
     * checkout, so Grok Bot must not count it as read, and it starts no push
     * notification or MCP Event.
     */
    readonly checkouts: Checkouts;
  } | null;
  /** The user's spending limits and paying with the one the assistant picks; null: no such tools. */
  readonly limitPayments?: LimitPayments | null;
  /** Seals spending limit request links; default from STYTCH_SECRET. Null: no request tool. */
  readonly limitRequests?: Buffer | null;
}

export interface UserProfile {
  readonly name: string | null;
  readonly email: string | null;
}

/**
 * How long one call follows a checkout before it returns "still working".
 * Measured in October 2026: Claude cuts a tool call at 240 s and ChatGPT at
 * 300 s; Codex defaults to 60 s, and other clients are unknown.
 */
export function followWindowMs(host: AppHost | null) {
  return host === "claude" || host === "chatgpt" || host === "local"
    ? 200_000
    : 50_000;
}

const answerValue = z.union([
  z.string().max(4000),
  z.number(),
  z.boolean(),
  z.array(z.string().max(500)).max(50),
]);

/** One MCP server per request, acting for one verified user. */
export function createCommerceServer({
  userId,
  checkouts: given,
  origin,
  host = null,
  cards = true,
  secure = null,
  profile = null,
  formState = null,
  liveViewOrigin = null,
  wait = null,
  grokBot = null,
  feedback = null,
  limitRequests,
  limitPayments = null,
}: CommerceServerOptions) {
  const via: Via | null = grokBot ? "grok" : host;
  const grokUpdates = grokBot?.updates ?? null;
  const hint =
    grokUpdates === "off" || grokUpdates === "none"
      ? `If the user wants to hear here when this checkout moves on after you stop, they can say "${UPDATES_PHRASE}" (then call grok_bot_updates_setup).`
      : null;
  // The secure step reaches only hosts that draw the card and keep app-only
  // tools from their model.
  const secureStep = secure && host && cards ? secure : null;
  const windowMs = wait?.windowMs ?? followWindowMs(host);
  const key = limitRequests === undefined ? limitRequestKey() : limitRequests;
  // A payment step links to the spending limit request page, sealed for this user.
  const checkouts = key
    ? linkPaymentsToLimits(given, { userId, origin, via, key })
    : given;

  // A forged or expired form state is refused (-32602) before any tool runs.
  const server = new McpServer(serverInfo(origin), {
    instructions,
    ...(formState ? { requestState: { verify: formState.verify } } : {}),
  });
  titleAnnotations(server);

  registerAddressTools(server, { userId, checkouts, profile });
  if (key) {
    registerLimitTools(server, { userId, checkouts, origin, via, key });
  }
  if (limitPayments) {
    registerLimitPayTools(server, {
      userId,
      payments: limitPayments,
      cards,
    });
  }

  // Only a client that draws the card gets it and its app-only tools.
  if (cards) {
    registerCard(server, {
      userId,
      checkouts,
      origin,
      host,
      via,
      secure: secureStep,
      // The card's reads tell the model the same payment step as continue.
      audience: {
        cards: true,
        support: noForms,
        limits: key !== null,
        pays: limitPayments !== null,
        // The card's reads are the card: the step is on screen.
        shown: true,
      },
    });
  }

  /** What this request's client can show; forms only for card-less clients. */
  function audienceOf(ctx: ServerContext): Audience {
    const support = formState
      ? formSupport(ctx.mcpReq.envelope, { cardHost: cards || host !== null })
      : noForms;
    return {
      cards,
      support,
      hint,
      limits: key !== null,
      pays: limitPayments !== null,
    };
  }

  function show(
    view: CheckoutView,
    audience: Audience,
    options: {
      note?: string;
      next?: string;
      extra?: Record<string, unknown>;
      role?: "start" | "step";
      meta?: Record<string, unknown>;
    } = {},
  ) {
    return present(view, {
      via,
      audience,
      secureStep: secureStep !== null,
      ...options,
    });
  }

  /** Follows the checkout until something needs the user, it ends, or the window is up. */
  async function follow(
    runId: string,
    ctx: ServerContext,
    afterRequestId?: string,
  ) {
    const followed = await waitForCheckout(() => checkouts.get(userId, runId), {
      afterRequestId,
      signal: ctx.mcpReq.signal,
      windowMs,
      ...(wait?.everyMs ? { everyMs: wait.everyMs } : {}),
    });
    return followed.view;
  }

  /** What following or a form returns: a checkout result, a form, or a failure. */
  type Moment =
    | ReturnType<typeof show>
    | ReturnType<typeof failure>
    | Awaited<ReturnType<typeof asking>>;

  /**
   * Follows, then shows where it got to. A step the user just finished is
   * still working while the store catches up, not a step to show again.
   */
  async function followed(
    runId: string,
    ctx: ServerContext,
    audience: Audience,
    afterRequestId?: string,
    options: { note?: string } = {},
  ) {
    const view = await follow(runId, ctx, afterRequestId);
    if (
      afterRequestId &&
      isActive(view) &&
      view.pending?.requestId === afterRequestId
    ) {
      return show(view, audience, {
        ...options,
        role: "start",
        next: `Still waiting on this step: the user may still be approving it, or the store hasn't moved on yet. That's normal, not an error: don't tell the user anything is wrong. Call continue with this runId and afterRequestId ${afterRequestId} again right away.`,
      });
    }
    return show(view, audience, options);
  }

  // -------------------------------------------------------------------------
  // Native forms (Codex, Claude Code, Cursor): a store question, or a link to
  // the secure page, asked in the host's own UI.

  function replyTo(ctx: ServerContext, expected: FormState, key: string) {
    if (!sameForm(ctx.mcpReq.requestState<FormState>(), expected)) {
      return { kind: "missing" } as const;
    }
    const reply = inputResponse(ctx.mcpReq.inputResponses, key);
    // Our state back without an answer: the host couldn't show the form.
    // Asking again would loop, so it counts as closed.
    return reply.kind === "missing"
      ? ({ kind: "elicit", action: "cancel" } as const)
      : reply;
  }

  /**
   * A store question in the host's form. On the retry the answers go to the
   * store and the checkout is followed on; closed, nothing is sent and the
   * model asks in chat instead.
   */
  async function questionByForm(
    view: CheckoutView,
    pending: Extract<
      NonNullable<CheckoutView["pending"]>,
      { kind: "question" }
    >,
    ctx: ServerContext,
    audience: Audience,
  ): Promise<Moment> {
    const form = questionForm(pending, audience.support);
    if (!form) {
      return failure(
        `This question asks for something private, so it isn't asked in a form. The user answers it at ${origin}/checkouts/${encodeURIComponent(view.runId)}.`,
      );
    }
    const asked = ctx.mcpReq.requestState<FormState>();
    const state: FormState = {
      form: QUESTION_FORM,
      runId: view.runId,
      requestId: pending.requestId,
    };
    const ask = (again: Form, sent?: string) =>
      asking(
        ctx,
        QUESTION_FORM,
        formRequest(again, audience.support),
        sent ? { ...state, sent } : state,
      );
    const reply = replyTo(ctx, state, QUESTION_FORM);
    const unanswered = () =>
      show(view, audience, {
        note: "The form came back unanswered. Don't open it again; ask in chat, listing the options.",
      });
    const content =
      reply.kind === "elicit" && reply.action === "accept"
        ? (reply.content ?? {})
        : null;
    const read = content ? readQuestion(form, pending, content) : null;
    // What happened to the form: no answers or question text, only which of
    // our fields came back and as what type.
    console.info("MCP form", {
      form: QUESTION_FORM,
      step: reply.kind === "elicit" ? reply.action : "ask",
      openai: audience.support.openai,
      ...(read
        ? {
            read: read.kind,
            returned: Object.entries(content ?? {}).map(([key, value]) =>
              key in form.requestedSchema.properties
                ? `${key}:${Array.isArray(value) ? "array" : typeof value}`
                : "unknown",
            ),
          }
        : {}),
    });
    if (reply.kind !== "elicit") {
      return ask(form);
    }
    if (reply.action !== "accept" || !content || !read) {
      return unanswered();
    }
    if (read.kind === "incomplete") {
      // Asked again with the problem. The same answer back unchanged means
      // nobody fixed it (a host that answers forms by itself), so the
      // question goes to chat instead of looping.
      const sent = createHash("sha256")
        .update(JSON.stringify(content))
        .digest("base64url")
        .slice(0, 16);
      return asked?.form === QUESTION_FORM && asked.sent === sent
        ? unanswered()
        : ask(askAgain(form, read.problem, content), sent);
    }
    await sendAnswer(
      checkouts,
      userId,
      view.runId,
      pending.requestId,
      read.kind === "instead" ? { text: read.text } : { answers: read.answers },
    );
    return followed(view.runId, ctx, audience, pending.requestId, {
      note: "The user answered in the form.",
    });
  }

  async function asking(
    ctx: ServerContext,
    key: string,
    request: InputRequest,
    state: FormState,
  ) {
    if (!formState) {
      throw new Error("Forms need a state key.");
    }
    return inputRequired({
      inputRequests: { [key]: request },
      requestState: await formState.mint(state, ctx),
    });
  }

  // -------------------------------------------------------------------------
  // The model's tools.

  const startInput = z.object({
    // Lenient on purpose: models often drop the scheme, and a schema rejection
    // draws a failed card before the corrected retry.
    storeUrl: z
      .string()
      .trim()
      .transform((value) =>
        /^https?:\/\//i.test(value) ? value : `https://${value}`,
      )
      .pipe(z.url({ protocol: /^https?$/ }))
      .describe(
        "The store's or service's home page, e.g. https://www.amazon.com/. Put the exact product, and its link if you have one, in task.",
      ),
    task: z
      .string()
      .min(1)
      .max(4000)
      .describe(
        "What the user asked for, short and in their words: the item or service and only the details they gave (size, color, quantity, dates, people, pickup). Start with the verb: 'Buy …', 'Book …', 'Return …', 'Cancel …', 'Sign in …' (with the account's email or phone when given, never a password or code). Don't add choices they didn't make, and leave out the price limit and the address: those are sent separately. E.g. 'Buy a 4-pack of AA batteries'.",
      ),
    maxCost: z
      .object({
        amount: z
          .union([z.string(), z.number()])
          .transform((value) =>
            typeof value === "number" ? value.toFixed(2) : value.trim(),
          )
          .pipe(z.string().regex(/^\d+(\.\d{1,2})?$/))
          .describe("Decimal string, e.g. '45.00'."),
        currency: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{3}$/)
          .default("USD")
          .describe("ISO 4217 code."),
      })
      .describe(
        "The most to spend, tax and shipping included: a generous ceiling, not a price. Infer it from what you know; ask the user only if you can't tell. For a task that buys nothing, like only signing in: 1.00.",
      ),
    ...shippingFields("the user's saved addresses (Menta matches the name)"),
    country: z
      .string()
      .regex(/^[A-Za-z]{2}$/)
      .optional()
      .describe(
        "ISO 3166-1 alpha-2 country the store should see the checkout in, e.g. 'US', for pickups and local orders. Leave it out to use the delivery address's country.",
      ),
  });

  server.registerTool(
    "start",
    {
      title: "Do it at a store",
      description: `Buy, order, book, reserve, return, cancel or reorder something at any online store or service for the user, with their own card, or sign in to their account there. Use it whenever the user asks to buy, order or book something online, or to sign in or log in to a store, and call it with what they gave, without asking them anything first: the checkout finds the item and asks for anything it needs, and the spending limit is settled at its payment step. Menta runs the checkout and returns when something needs the user (a question, a payment) or it's done. Menta pays only from spending limits the user approves; you can't approve one. Not idempotent: if a result is unclear, look at history before starting again.`,
      inputSchema: startInput,
      annotations: {
        readOnlyHint: false,
        // It can end in a charge: when the user picks a card saved on the store
        // account, the store charges it without Menta's approval step.
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
      _meta: toolStatusMeta("Starting…", "Checkout started"),
    },
    (input, ctx) =>
      run(
        async () => {
          const audience = audienceOf(ctx);
          const { storeUrl, ...rest } = input;
          const request = { ...rest, startUrl: storeUrl };
          const started = await checkouts.create(userId, request);
          if (started.status === "which_address") {
            return result({
              whichAddress: {
                requested: started.requested,
                options: started.options,
              },
              next: notStartedForModel(started, ADDRESS_TOOLS).next,
            });
          }
          if (notStarted(started)) {
            // Someone not saved yet: the model asks in chat and saves it.
            return result({
              addressNeeded: {
                label: started.label,
                cityHint: started.cityHint,
              },
              next: notStartedForModel(started, ADDRESS_TOOLS).next,
            });
          }
          // Follow it to the first thing that needs the user; a card host shows
          // that step with show_checkout_step, not a progress card.
          const view = await follow(started.runId, ctx);
          const next = nextStep(view, audience);
          const offer = await offerUpdates();
          return show(view, audience, {
            next: offer ? `${next} ${offer}` : next,
          });
        },
        (error) =>
          (error as Partial<CheckoutError> | null)?.code === "address_label"
            ? errorMessage(error)
            : `${errorMessage(error)} Starting is not idempotent: look at history before trying again.`,
      ),
  );

  server.registerTool(
    "answer",
    {
      title: "Answer the store",
      description: `Send the store the user's answer, then follow the checkout to the next thing that needs them. While the store asks a question: answers keyed by its field keys (choice fields take option values), or text in the user's own words when the options don't fit. With no question open, text tells the checkout something to follow from now on ("use standard shipping"). Never card numbers, codes or passwords: the user enters those ${cards ? "in the Menta card or " : ""}on the secure page.${cards ? " The user can also answer in the card." : ""}`,
      inputSchema: z.object({
        runId,
        answers: z
          .record(z.string().min(1).max(200), answerValue)
          .optional()
          .describe("Answers keyed by field key."),
        text: z
          .string()
          .min(1)
          .max(1000)
          .optional()
          .describe("The user's own words, instead of answers."),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: toolStatusMeta("Sending…", "Sent"),
    },
    ({ runId, answers, text }, ctx) =>
      run(async () => {
        const audience = audienceOf(ctx);
        if (answers !== undefined && text !== undefined) {
          return failure("Send answers or text, not both.");
        }
        const view = await checkouts.get(userId, runId);
        const pending = view.pending;
        const byUser = answers === undefined && text === undefined;
        if (!pending || pending.kind === "payment") {
          if (byUser && pending && audience.support.url) {
            return secureLink(view, pending, audience, ctx);
          }
          if (text === undefined) {
            return failure(
              pending
                ? `Only the user can approve a payment, on the secure page${cards ? " or in the card" : ""}.`
                : "Nothing is waiting for an answer. Send text to tell the checkout something.",
            );
          }
          await checkouts.steer(
            userId,
            runId,
            messageId([userId, runId, "steer", text]),
            text,
          );
          return show(await follow(runId, ctx), audience);
        }
        if (pending.kind === "protected") {
          if (byUser && audience.support.url) {
            return secureLink(view, pending, audience, ctx);
          }
          if (text === undefined) {
            return failure(
              `Private details are entered by the user, ${cards ? "in the card or " : ""}at pending.actionUrl.`,
            );
          }
          await sendAnswer(checkouts, userId, runId, pending.requestId, {
            text,
          });
          return followed(runId, ctx, audience, pending.requestId);
        }
        if (byUser) {
          if (!audience.support.forms) {
            return failure(
              "Ask the user, then send their reply as answers or text.",
            );
          }
          return questionByForm(view, pending, ctx, audience);
        }
        if (text !== undefined) {
          await sendAnswer(checkouts, userId, runId, pending.requestId, {
            text,
          });
        } else {
          const given = answers ?? {};
          const keys = new Set(pending.fields.map((field) => field.key));
          const unknown = Object.keys(given).filter((key) => !keys.has(key));
          if (unknown.length > 0) {
            return failure(
              `Unknown field keys: ${unknown.join(", ")}. Use the keys in pending.fields.`,
            );
          }
          await sendAnswer(checkouts, userId, runId, pending.requestId, {
            answers: given,
          });
        }
        return followed(runId, ctx, audience, pending.requestId);
      }),
  );

  /**
   * Payment approval or private details for a client that opens links: the
   * host asks the user to open Menta (the spending limit request page for a
   * payment, the secure page for private details), where Crossmint's own
   * components take them. Returns right away; `continue` follows it.
   */
  async function secureLink(
    view: CheckoutView,
    pending: Exclude<
      NonNullable<CheckoutView["pending"]>,
      { kind: "question" }
    >,
    audience: Audience,
    ctx: ServerContext,
  ) {
    const state: FormState = {
      form: SECURE_LINK,
      runId: view.runId,
      requestId: pending.requestId,
    };
    const reply = replyTo(ctx, state, SECURE_LINK);
    if (reply.kind !== "elicit") {
      const tagged = withHost(view, via).pending;
      const url =
        tagged && tagged.kind !== "question"
          ? tagged.actionUrl
          : pending.actionUrl;
      const message =
        pending.kind === "payment"
          ? `Approve a spending limit of ${pending.amount.amount} ${pending.amount.currency} for ${pending.merchant.name} on Menta. Your assistant never sees your card.`
          : `${view.store} needs private details. Enter them on Menta; your assistant never sees them.`;
      return asking(ctx, SECURE_LINK, linkRequest(message, url), state);
    }
    return show(view, audience, {
      next:
        reply.action === "accept"
          ? `The user is opening Menta. Call continue with this runId and afterRequestId ${pending.requestId}.`
          : "The user didn't open Menta. Give them pending.actionUrl when they're ready.",
    });
  }

  server.registerTool(
    "continue",
    {
      title: "Follow the checkout",
      description: `Follow a checkout to the next thing that needs the user, or its end: after start or answer returned still working, after the user answered or approved${cards ? " in the Menta card" : ""}, or after they used the secure page.`,
      inputSchema: z.object({
        runId,
        afterRequestId: z
          .string()
          .min(1)
          .max(200)
          .optional()
          .describe(
            "The pending.requestId the user just answered or approved, so it isn't reported again while the store catches up.",
          ),
      }),
      annotations: readOnly,
      _meta: toolStatusMeta("Following the checkout…", "Checked"),
    },
    ({ runId, afterRequestId }, ctx) =>
      run(async () => followed(runId, ctx, audienceOf(ctx), afterRequestId)),
  );

  // The Menta card, drawn only when the user is needed (a question, a payment,
  // private details) or for a receipt: never for progress or other endings.
  if (cards) {
    registerAppTool(
      server,
      SHOW_TOOL,
      {
        title: "Show the checkout step",
        description:
          "Show the user the step a checkout is at in the Menta card: the store's question, the spending limit a payment needs, private details to enter, or the receipt once an order is placed. Call it only when a result's next says to; the user acts in the card.",
        inputSchema: z.object({
          runId,
          // Checked as a language tag by localeMeta; anything else (a long
          // string, null, a number) is dropped, never an error.
          language: z
            .string()
            .max(64)
            .optional()
            .catch(undefined)
            .describe(
              "The language you're writing to the user in, as a language code like es or pt-BR. The card uses it for its own text.",
            ),
        }),
        annotations: readOnly,
        _meta: checkoutCardToolMeta("Showing the step…", "Shown"),
      },
      ({ runId, language }, ctx) =>
        run(async () => {
          const view = await checkouts.get(userId, runId, { progress: true });
          return show(
            view,
            { ...audienceOf(ctx), shown: true },
            { role: "step", meta: localeMeta(ctx.mcpReq._meta, language) },
          );
        }),
    );
  }

  server.registerTool(
    "cancel",
    {
      title: "Cancel a checkout",
      description:
        "Stop a checkout the user wants to cancel. Cancelling can race an order that is already being placed, so report the returned status.",
      inputSchema: z.object({ runId }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: toolStatusMeta("Cancelling…", "Cancel requested"),
    },
    ({ runId }, ctx) =>
      run(async () => {
        await checkouts.cancel(userId, runId);
        return show(await checkouts.get(userId, runId), audienceOf(ctx));
      }),
  );

  server.registerTool(
    "history",
    {
      title: "Checkout history",
      description:
        "The user's checkouts, newest first, or one checkout by runId: status, what it's waiting on, and the receipt. Use it when the user asks about an order, or before starting again after an unclear result.",
      inputSchema: z.object({
        runId: runId.optional(),
        cursor: z
          .string()
          .max(500)
          .optional()
          .describe("nextCursor from a previous page."),
      }),
      annotations: readOnly,
      _meta: toolStatusMeta("Looking at your checkouts…", "Checkouts"),
    },
    ({ runId, cursor }, ctx) =>
      run(async () => {
        if (runId) {
          return show(await checkouts.get(userId, runId), audienceOf(ctx));
        }
        const page = await checkouts.list(userId, {
          limit: 10,
          ...(cursor ? { cursor } : {}),
        });
        return result({
          checkouts: page.runs.map((view) => forModel(withHost(view, via))),
          nextCursor: page.nextCursor,
        });
      }),
  );

  server.registerTool(
    "manage",
    {
      title: "Cards and addresses",
      description:
        "Links where the user adds or changes their saved cards and addresses, signed in to Menta. Card details are entered only in Crossmint's secure form there, never in chat. For addresses in chat, use delivery_addresses and save_delivery_address instead.",
      inputSchema: z.object({}),
      annotations: readOnly,
      _meta: toolStatusMeta("Getting your account links…", "Account links"),
    },
    () =>
      result({
        cards: `${origin}/wallet`,
        addresses: `${origin}/addresses`,
        next: "Give the user the link they need.",
      }),
  );

  /** Grok Bot's one-time offer of updates, for a user who never set them up. */
  async function offerUpdates(): Promise<string | null> {
    if (grokUpdates !== "none" || !grokBot?.offer || !(await grokBot.offer())) {
      return null;
    }
    return `Once, at the end of your next message to the user, add this offer in one short line: "Want me to let you know here when a checkout needs you, even after this chat? Say '${UPDATES_PHRASE}'." If they say it, call grok_bot_updates_setup. Never offer it again.`;
  }

  if (grokUpdates !== null) {
    server.registerTool(
      "grok_bot_updates_setup",
      {
        title: "Set up Menta updates",
        description: `Grok Bot only. Sets up Menta updates: a Grok Bot routine that Menta starts by webhook when a checkout needs the user or finishes after this chat. Call it when the user says "${UPDATES_PHRASE}" or asks to hear about their checkouts later. You create the routine and its webhook trigger; the user pastes the routine's webhook URL and key on their Menta account page, never in chat.`,
        inputSchema: z.object({}),
        annotations: readOnly,
        _meta: toolStatusMeta(
          "Checking Menta updates…",
          "Menta updates checked",
        ),
      },
      async () => {
        // Asked about it: the one-time offer after a first checkout would repeat it.
        await grokBot?.offer?.();
        return result(grokBotSetup(origin, grokUpdates));
      },
    );
  }

  if (feedback) {
    registerFeedback(server, {
      userId,
      checkouts: feedback.checkouts,
      channel: feedback.channel,
      origin,
      liveViewOrigin: liveViewOrigin ?? null,
      host,
      grokBot: grokBot !== null,
      assistant: feedback.assistant,
    });
  }

  // Plugin settings (Settings inside ChatGPT): app-only tools, so only for
  // hosts that keep them from the model. See settings.ts.
  if (offersSettings(host)) {
    registerSettings(server, { userId, checkouts, origin });
  }

  return server;
}
