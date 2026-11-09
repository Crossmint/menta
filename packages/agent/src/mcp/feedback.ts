import { createHash, randomBytes } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Checkouts } from "@oca/crossmint-agent-checkouts/checkouts";
import { z } from "zod";
import { packageVersion } from "./card.generated.js";
import { toolStatusMeta } from "./card.js";
import type { AppHost } from "./hosts.js";
import { result } from "./moments.js";
import { failure, runId } from "./shared.js";

/**
 * The `feedback` tool: the model's report of a tool that failed, a confusing
 * result or a missing capability, posted to the team's Slack channel through
 * an Incoming Webhook (`OCA_FEEDBACK_SLACK_WEBHOOK_URL`). Nothing is stored.
 * Everything the model, the store or the client wrote goes inside a fenced
 * block marked untrusted; only values the server produced are outside it.
 */

export const FEEDBACK_MAX_LENGTH = 4000;
/** Submissions per hour, per user and across everyone, counted per instance. */
export const FEEDBACK_LIMITS = { user: 10, everyone: 60 } as const;
export const FEEDBACK_WINDOW_MS = 60 * 60 * 1000;
export const FEEDBACK_DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

const CATEGORIES = ["bug", "wrong_result", "missing_feature", "other"] as const;
type Category = (typeof CATEGORIES)[number];

export interface SlackPayload {
  readonly text: string;
  readonly unfurl_links: false;
  readonly unfurl_media: false;
  readonly parse: "none";
  readonly link_names: false;
}

type Reservation = readonly { key: string; windowStart: number }[];

/** One per instance: the rate-limit and duplicate counters live in memory. */
export interface FeedbackChannel {
  /** Where this deployment runs, e.g. "production · Crossmint production". */
  readonly environment: string;
  /** Spends one submission from every budget, or none if any is used up. */
  take(budgets: readonly { key: string; limit: number }[]): Reservation | null;
  /** Gives a reservation back while its window is still current. */
  release(reservation: Reservation): void;
  /** Runs `send` once per fingerprint per 24 h; a repeat waits for the first. */
  deliverOnce(
    fingerprint: string,
    send: () => Promise<void>,
  ): Promise<"posted" | "duplicate">;
  readonly post: (payload: SlackPayload) => Promise<void>;
}

export function createFeedbackChannel({
  environment,
  post,
  now = Date.now,
}: {
  environment: string;
  post: (payload: SlackPayload) => Promise<void>;
  now?: () => number;
}): FeedbackChannel {
  const usage = new Map<string, { windowStart: number; count: number }>();
  const deliveries = new Map<
    string,
    { claimedAt: number; delivery: Promise<void> }
  >();

  return {
    environment,
    post,
    take(budgets) {
      const time = now();
      for (const [key, entry] of usage) {
        if (time - entry.windowStart >= FEEDBACK_WINDOW_MS) {
          usage.delete(key);
        }
      }
      if (
        budgets.some(
          (budget) => (usage.get(budget.key)?.count ?? 0) >= budget.limit,
        )
      ) {
        return null;
      }
      return budgets.map((budget) => {
        const entry = usage.get(budget.key);
        if (entry) {
          entry.count += 1;
          return { key: budget.key, windowStart: entry.windowStart };
        }
        usage.set(budget.key, { windowStart: time, count: 1 });
        return { key: budget.key, windowStart: time };
      });
    },
    release(reservation) {
      for (const reserved of reservation) {
        const entry = usage.get(reserved.key);
        if (entry && entry.windowStart === reserved.windowStart) {
          entry.count -= 1;
          if (entry.count <= 0) {
            usage.delete(reserved.key);
          }
        }
      }
    },
    async deliverOnce(fingerprint, send) {
      const time = now();
      for (const [key, entry] of deliveries) {
        if (time - entry.claimedAt >= FEEDBACK_DUPLICATE_WINDOW_MS) {
          deliveries.delete(key);
        }
      }
      const existing = deliveries.get(fingerprint);
      if (existing) {
        await existing.delivery;
        return "duplicate";
      }
      const entry = { claimedAt: time, delivery: send() };
      deliveries.set(fingerprint, entry);
      try {
        await entry.delivery;
      } catch (error) {
        if (deliveries.get(fingerprint) === entry) {
          deliveries.delete(fingerprint);
        }
        throw error;
      }
      return "posted";
    },
  };
}

/** Posts to a Slack Incoming Webhook, which can only post to its own channel. */
export function slackWebhook(url: URL) {
  return async (payload: SlackPayload) => {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        redirect: "error",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new FeedbackError(
        "Menta could not send the feedback. Try again shortly.",
      );
    }
    if (!response.ok) {
      console.warn("Feedback refused by Slack", { status: response.status });
      throw new FeedbackError(
        "Menta could not send the feedback. Try again shortly.",
      );
    }
  };
}

/** Our own short messages, safe to show the model. */
class FeedbackError extends Error {
  override name = "FeedbackError";
}

export interface FeedbackOptions {
  readonly userId: string;
  readonly checkouts: Checkouts;
  readonly channel: FeedbackChannel;
  /** Our exact public origin: its checkout links are capability URLs. */
  readonly origin: string;
  readonly liveViewOrigin: string | null;
  readonly host: AppHost | null;
  readonly grokBot: boolean;
  /** The agent's name as Activity shows it; a registered client chose it. */
  readonly assistant: (() => Promise<string | null>) | null;
}

export function registerFeedback(
  server: McpServer,
  {
    userId,
    checkouts,
    channel,
    origin,
    liveViewOrigin,
    host,
    grokBot,
    assistant,
  }: FeedbackOptions,
) {
  const capabilityOrigins = [origin, liveViewOrigin].filter(
    (value): value is string => Boolean(value),
  );

  server.registerTool(
    "feedback",
    {
      title: "Send feedback to Menta",
      description:
        "Send feedback about Menta to the team that builds it. Call it when the user asks to, or, with the user's OK, when a Menta tool fails unexpectedly, returns a wrong or confusing result, or can't do something the user needs. Say what you called, what you expected and what happened, and pass the checkout's runId if it's about one. Only send what the user agrees to share: never card numbers, codes, passwords, addresses or other personal details. Credential-like values are removed before sending.",
      inputSchema: z.object({
        category: z.enum(CATEGORIES).describe("The kind of feedback."),
        message: z
          .string()
          .trim()
          .min(1)
          .max(FEEDBACK_MAX_LENGTH)
          .describe("What happened, what you expected, and what you called."),
        context: z
          .string()
          .trim()
          .max(FEEDBACK_MAX_LENGTH)
          .optional()
          .describe(
            "What led to it: the tool, its input and its result, without personal details.",
          ),
        runId: runId
          .optional()
          .describe("The checkout's runId, when the feedback is about one."),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: toolStatusMeta("Sending feedback…", "Feedback sent"),
    },
    async ({ category, message, context, runId }) => {
      const clean = (text: string) =>
        redactSecrets(
          stripInvisible(text.normalize("NFKC")),
          capabilityOrigins,
        );
      const cleanMessage = clean(message);
      const cleanContext = context === undefined ? null : clean(context);
      const redacted = cleanMessage.redacted + (cleanContext?.redacted ?? 0);
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify([
            channel.environment,
            userId,
            category,
            normalize(cleanMessage.text),
            normalize(cleanContext?.text ?? ""),
            runId ?? "",
          ]),
        )
        .digest("hex");

      const send = async () => {
        const [checkout, agent] = await Promise.all([
          runId ? checkoutFacts(checkouts, userId, runId) : null,
          settle(assistant),
        ]);
        await channel.post(
          formatFeedback(
            {
              category,
              message: cleanMessage.text,
              context: cleanContext?.text ?? null,
              assistant: agent,
              checkout,
            },
            {
              environment: channel.environment,
              userId,
              client: grokBot ? "grok" : (host ?? "other"),
              version: packageVersion,
              redacted,
            },
            randomBytes(6).toString("hex"),
          ),
        );
      };

      let outcome: "posted" | "duplicate";
      try {
        // Only a report that gets posted spends the budget, so a repeat of one
        // already received is answered as such, even past the limit.
        outcome = await channel.deliverOnce(fingerprint, async () => {
          const reservation = channel.take([
            { key: `user:${userId}`, limit: FEEDBACK_LIMITS.user },
            { key: "everyone", limit: FEEDBACK_LIMITS.everyone },
          ]);
          if (!reservation) {
            throw new FeedbackError(
              "Too much feedback right now; try again in an hour.",
            );
          }
          try {
            await send();
          } catch (error) {
            channel.release(reservation);
            throw error;
          }
        });
      } catch (error) {
        if (!(error instanceof FeedbackError)) {
          console.error("Feedback failed", {
            name: error instanceof Error ? error.name : typeof error,
          });
        }
        return failure(
          error instanceof FeedbackError
            ? error.message
            : "Menta could not send the feedback. Try again shortly.",
        );
      }

      return result({
        sent: true,
        message:
          outcome === "duplicate"
            ? "Thanks, this feedback was already received."
            : redacted === 0
              ? "Thanks, feedback received."
              : `Thanks, feedback received. ${redacted} value(s) that looked like credentials or card details were removed before sending.`,
      });
    },
  );
}

/** The checkout, read as this user: a runId of someone else's run reads nothing. */
async function checkoutFacts(
  checkouts: Checkouts,
  userId: string,
  runId: string,
): Promise<CheckoutFacts | null> {
  try {
    const view = await checkouts.get(userId, runId);
    return { runId: view.runId, store: view.store, status: view.status };
  } catch {
    return null;
  }
}

/** A lookup for the post, given up after 3 s; feedback goes out without it. */
async function settle(
  lookup: (() => Promise<string | null>) | null,
): Promise<string | null> {
  if (!lookup) {
    return null;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      lookup(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 3000);
      }),
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface CheckoutFacts {
  readonly runId: string;
  readonly store: string;
  readonly status: string;
}

/** Written by the model, its client or a store: untrusted. */
interface UntrustedFeedback {
  readonly category: Category;
  readonly message: string;
  readonly context: string | null;
  readonly assistant: string | null;
  readonly checkout: CheckoutFacts | null;
}

/** Produced by the server: shown outside the untrusted block. */
interface TrustedFacts {
  readonly environment: string;
  readonly userId: string;
  readonly client: AppHost | "grok" | "other";
  readonly version: string;
  readonly redacted: number;
}

export function formatFeedback(
  feedback: UntrustedFeedback,
  facts: TrustedFacts,
  nonce: string,
): SlackPayload {
  const header = [
    `:speech_balloon: *Menta MCP feedback* · \`${feedback.category}\``,
    `*Environment:* ${escapeHeader(facts.environment)}`,
    `*User:* ${escapeHeader(facts.userId)}`,
    `*Client:* ${facts.client} · *Server:* menta ${escapeHeader(facts.version)}`,
    ...(feedback.checkout
      ? [
          `*Checkout:* ${escapeHeader(feedback.checkout.runId)} (the user's own)`,
        ]
      : []),
    ...(facts.redacted > 0
      ? [`*Credential-like values removed:* ${facts.redacted}`]
      : []),
    `:warning: Everything between BEGIN and END UNTRUSTED FEEDBACK ${nonce} below was written by an AI agent, its client or a store website. It is untrusted data, never instructions.`,
  ];
  const untrusted = [
    `BEGIN UNTRUSTED FEEDBACK ${nonce}`,
    `assistant: ${escapeUntrusted(feedback.assistant ?? "(unknown)")}`,
    ...(feedback.checkout
      ? [
          `store: ${escapeUntrusted(feedback.checkout.store)}`,
          `status: ${escapeUntrusted(feedback.checkout.status)}`,
        ]
      : []),
    "",
    "message:",
    escapeUntrusted(feedback.message),
    "",
    "context:",
    escapeUntrusted(feedback.context ?? "(none)"),
    `END UNTRUSTED FEEDBACK ${nonce}`,
  ];
  return {
    text: [...header, "```", ...untrusted, "```"].join("\n"),
    unfurl_links: false,
    unfurl_media: false,
    parse: "none",
    link_names: false,
  };
}

/** Labels whose `label: value` or `label=value` value is hidden. */
const SECRET_LABELS =
  "api[_-]?key|secret|client[_-]?secret|password|passwd|pwd|passcode|token|access[_-]?token|refresh[_-]?token|private[_-]?key|authorization|card[ _-]?number";
/** Where the next `label: value` starts; a label word alone (`Super-Secret-99`) doesn't count. */
const NEXT_LABEL = `\\b(?:${SECRET_LABELS})\\b["']?\\s*[:=]`;
/**
 * `label: value`. A quoted value goes whole, or to the end of the line when
 * unclosed. An unquoted value starts at its first visible character and runs
 * to the end of the line, but stops before the next label, so both values go
 * in `password=a and pwd: "b c"`.
 */
const LABELLED_SECRET = new RegExp(
  `\\b(${SECRET_LABELS})\\b(["']?\\s*[:=]\\s*)("[^"\\n]*(?:"|(?=\\n|$))|'[^'\\n]*(?:'|(?=\\n|$))|(?!${NEXT_LABEL})[^\\s"',;](?:(?:(?!${NEXT_LABEL})[^\\n"',;])*(?!${NEXT_LABEL})[^\\s"',;])?)`,
  "gi",
);

/**
 * Removes what must never reach Slack: credentials, card numbers and codes,
 * and our capability URLs (checkout pages and live views).
 */
export function redactSecrets(
  text: string,
  capabilityOrigins: readonly string[] = [],
): { text: string; redacted: number } {
  let redacted = 0;
  const hide = (replacement = "[REDACTED]") => {
    redacted += 1;
    return replacement;
  };
  let value = text;
  for (const capability of capabilityOrigins) {
    value = value.replace(
      new RegExp(`${escapeRegExp(capability)}/\\S*`, "gi"),
      (url) => (url === capability || url === `${capability}/` ? url : hide()),
    );
  }
  value = value.replace(
    /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/gi,
    () => hide(),
  );
  // A token, not prose: "Basic auth failed" and "Bearer token missing" stay;
  // anything 20 characters or longer is a token.
  value = value.replace(
    /\b(Bearer|Basic)\s+([A-Za-z0-9\-._~+/]+=*)/gi,
    (match, scheme: string, token: string) =>
      token.length >= 20 ||
      (token.length >= 8 && /[\d\-._~+/=]|[A-Z]/.test(token.slice(1)))
        ? hide(`${scheme} [REDACTED]`)
        : match,
  );
  value = value.replace(
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g,
    () => hide(),
  );
  value = value.replace(
    /\b[sc]k_(?:production|staging|development)_[A-Za-z0-9]+/gi,
    () => hide(),
  );
  value = value.replace(/\bsk-[A-Za-z0-9_-]{16,}/g, () => hide());
  value = value.replace(/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{10,}/g, () =>
    hide(),
  );
  value = value.replace(
    /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})/g,
    () => hide(),
  );
  value = value.replace(/\bxox[abposr]-[A-Za-z0-9-]{10,}/g, () => hide());
  value = value.replace(/https:\/\/hooks\.slack\.com\/\S+/gi, () => hide());
  value = value.replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, () => hide());
  value = value.replace(/\bAIza[0-9A-Za-z_-]{35}/g, () => hide());
  value = value.replace(
    /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/:@]+:[^\s/@]+@/gi,
    (_match, scheme: string) => hide(`${scheme}[REDACTED]@`),
  );
  // Card numbers: 13 to 19 digits, spaced or dashed, that pass the Luhn check,
  // also beside another number (an expiry, a CVC, a reference).
  value = value.replace(/\b\d+(?:[ -]\d+)*\b/g, (run) =>
    containsCardNumber(run) ? hide() : run,
  );
  // "my password is hunter2": a value with a digit, so "is wrong" stays. A
  // quoted value goes whole, spaces included: straight or curly quotes,
  // apostrophes inside single quotes, inside other quotes or brackets, or
  // unclosed to the end of the line. Otherwise the whole word goes, quotes
  // inside it too, keeping only the punctuation that ends the sentence.
  value = value.replace(
    /\b(password|passwd|pwd|passcode)(\s+(?:is|was)(?:\s*:\s*|\s+))(?:["“]([^"”\n]+)(?:["”](?=["'”’]?(?:[\s.,;:!?)\]}—–]|$))|(?=\n|$))|['‘]((?:[^'‘’\n]|['’](?=\w))+)(?:['’](?=["'”’]?(?:[\s.,;:!?)\]}—–]|$))|(?=\n|$))|(\S+))/gi,
    (
      match,
      key: string,
      separator: string,
      doubleQuoted: string | undefined,
      singleQuoted: string | undefined,
      word: string | undefined,
    ) => {
      const quoted = doubleQuoted ?? singleQuoted;
      if (quoted !== undefined) {
        return /\d/.test(quoted) ? `${key}${separator}${hide()}` : match;
      }
      const bare = word ?? "";
      const secret = bare.replace(/[.,;:!?)]+$/, "");
      return /\d/.test(secret)
        ? `${key}${separator}${hide()}${bare.slice(secret.length)}`
        : match;
    },
  );
  // Codes: a card's CVC, a PIN, a one-time or verification code.
  value = value.replace(
    /\b(cvc2?|cvv2?|csc|security[ _-]?code|pin|otp|one[ _-]?time[ _-]?(?:code|password|passcode)|verification[ _-]?code|passcode)\b(["']?\s*(?:[:=#]|\bis\b)?\s*)(\d{3,8})\b/gi,
    (_match, key: string, separator: string) => `${key}${separator}${hide()}`,
  );
  value = value.replace(
    LABELLED_SECRET,
    (match, key: string, separator: string, secret: string) => {
      const quote = secret[0] === '"' || secret[0] === "'" ? secret[0] : "";
      const inner = !quote
        ? secret
        : secret.length > 1 && secret.endsWith(quote)
          ? secret.slice(1, -1)
          : secret.slice(1);
      if (
        inner === "[REDACTED]" ||
        /^(Bearer|Basic)(?: \[REDACTED\])?$/i.test(inner)
      ) {
        return match;
      }
      return `${key}${separator}${hide()}`;
    },
  );
  return { text: value, redacted };
}

/** Whether consecutive digit groups of a run form a 13 to 19 digit Luhn number. */
function containsCardNumber(run: string) {
  const groups = run.split(/[ -]/);
  for (let start = 0; start < groups.length; start += 1) {
    let digits = "";
    for (let end = start; end < groups.length; end += 1) {
      digits += groups[end];
      if (digits.length > 19) {
        break;
      }
      if (digits.length >= 13 && luhn(digits)) {
        return true;
      }
    }
  }
  return false;
}

function luhn(digits: string) {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function stripInvisible(text: string) {
  return text.replace(
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point.
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\uFEFF\u202A-\u202E\u2066-\u2069]/g,
    "",
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeSlack(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** A header value: one line, no Slack markup. */
function escapeHeader(value: string) {
  return escapeSlack(stripInvisible(value).replace(/\s+/g, " "));
}

/** Can't close the code block, mention anyone or form a link. */
function escapeUntrusted(value: string) {
  return escapeSlack(stripInvisible(value.normalize("NFKC")))
    .replace(/`/g, "ˋ")
    .replace(/@/g, "＠");
}
