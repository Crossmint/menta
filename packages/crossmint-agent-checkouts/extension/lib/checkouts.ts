import type {
  AgentCheckoutBuyerProfileResponseDto,
  AgentCheckoutMessageListResponseDto,
  AgentCheckoutResponseDto,
  CrossmintSdk,
} from "@crossmint/rest-js";
import {
  type CheckoutProgress,
  emptyLog,
  foldMessages,
  messagesPage,
  type ProgressLog,
  progressOf,
} from "./progress.js";

export type {
  CheckoutProgress,
  ProgressStep,
  StepStatus,
} from "./progress.js";

export type CheckoutsApi = CrossmintSdk["agentCheckouts"];
type Run = AgentCheckoutResponseDto;
type PendingRequest = Extract<
  Run,
  { status: "awaiting_input" }
>["requiredAction"]["request"];
export type FormField = Extract<
  PendingRequest["interaction"],
  { kind: "form" }
>["fields"][number];

export type CheckoutStatus = Run["status"];

export interface Money {
  readonly amount: string;
  readonly currency: string;
}

export interface QuestionField {
  readonly key: string;
  readonly label: string;
  readonly required: boolean;
  readonly kind: "text" | "number" | "integer" | "boolean" | "choice";
  readonly multiple?: boolean;
  readonly options?: readonly {
    value: string;
    label: string;
    /** An https picture of the option. Crossmint's options carry none yet. */
    image?: string;
  }[];
  readonly placeholder?: string;
  /**
   * An ordinary field that looks secret (a masked input, or password or
   * one-time-code autofill). Never asked in a host's native form; the user
   * answers it in our own UI.
   */
  readonly sensitive?: true;
}

/** What the store is waiting on. Payment and protected fields only complete in Crossmint's UI in the signed-in web app. */
export type CheckoutPending =
  | {
      readonly kind: "payment";
      readonly requestId: string;
      readonly question: string;
      readonly expiresAt: string | null;
      readonly amount: Money & { readonly exact: boolean };
      readonly merchant: {
        readonly name: string;
        readonly url: string;
        readonly countryCode: string;
      };
      readonly actionUrl: string;
    }
  | {
      readonly kind: "question";
      readonly requestId: string;
      readonly question: string;
      readonly expiresAt: string | null;
      readonly fields: readonly QuestionField[];
    }
  | {
      readonly kind: "protected";
      readonly requestId: string;
      readonly question: string;
      readonly expiresAt: string | null;
      /** Crossmint's descriptors, passed unchanged to its protected-input component. */
      readonly fields: readonly FormField[];
      /** The request's ordinary (non-protected) fields, shaped like a question's. */
      readonly standard: readonly QuestionField[];
      readonly actionUrl: string;
    };

export interface CheckoutView {
  readonly runId: string;
  readonly revision: number;
  readonly status: CheckoutStatus;
  readonly createdAt: string | null;
  readonly startUrl: string;
  readonly store: string;
  readonly task: string | null;
  readonly maxCost: Money;
  /** Whether the run was given one of the user's saved addresses. */
  readonly usesSavedDetails: boolean;
  /** Which saved address the run ships to, display-safe (no street or name). Null when none or unknown. */
  readonly shipsTo: ShipsTo | null;
  /** Delivery, pickup, or no shipping; only a delivery shows `shipsTo`. */
  readonly fulfillment: Fulfillment;
  /** Read-only live browser. A capability URL: show it to the signed-in owner, never to the model. */
  readonly liveViewUrl: string | null;
  readonly pending: CheckoutPending | null;
  /**
   * What the checkout's browser agent is doing, from Crossmint's run
   * messages. For the owner's UI only, never the model (see `forModel`).
   * Null when not read (lists, the agent's own reads) or unavailable.
   */
  readonly progress: CheckoutProgress | null;
  readonly result: {
    readonly summary: string | null;
    readonly receipt: { total: Money; merchantOrderId: string | null } | null;
    readonly confirmedWithoutReceipt: boolean;
    readonly blockedCode: string | null;
    readonly failureReason: string | null;
  } | null;
}

/**
 * A payment made from a spending limit the user's assistant picked: its
 * name, the amount, and what's left. When the store asked for a maximum (`exact`
 * false), the amount is that maximum and what's left is at least `left`.
 */
export interface PaidFrom {
  readonly limit: string;
  readonly amount: Money & { readonly exact: boolean };
  readonly left: Money;
}

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly code: string | null = null,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

/** Saved buyer details (a Crossmint buyer profile) that checkouts prefill. Never payment data. */
export interface BuyerDetails {
  readonly name?: { readonly first?: string; readonly last?: string };
  readonly contact?: { readonly email?: string; readonly phone?: string };
  readonly shipping: {
    readonly addressLines: string[];
    readonly locality: string;
    /** ISO 3166-2 subdivision, e.g. "US-CA". */
    readonly administrativeAreaCode?: string | null;
    readonly postalCode?: string | null;
    /** ISO 3166-1 alpha-2. */
    readonly countryCode: string;
  };
}

/**
 * How an order reaches the user: shipped, collected at the store (restaurant
 * pickup), or not at all (tickets, digital goods, in-store). Only deliveries
 * ship anywhere; the others use an address for its contact details only.
 */
export type Fulfillment = "delivery" | "pickup" | "none";

/**
 * Whom a delivery is for. `me`: the user's own place (their default address,
 * or an own place they name). `store_account`: the user asked for the address
 * saved on their store account, so none of ours is attached. `someone_else`:
 * another person, named by `addressLabel`.
 */
export type DeliverTo = "me" | "store_account" | "someone_else";

/**
 * The fulfillment a run was started with. Runs started before we stopped
 * sending merchant guidance (it replaces Universal Checkout's own) carry it
 * as their first guidance line; newer runs read as deliveries.
 */
export function fulfillmentOf(
  guidance: string | null | undefined,
): Fulfillment {
  const first = guidance?.trimStart() ?? "";
  if (first.startsWith("Fulfillment: pickup.")) {
    return "pickup";
  }
  if (first.startsWith("Fulfillment: no shipping")) {
    return "none";
  }
  return "delivery";
}

/**
 * A delivery to someone else who has no saved address: the one case that
 * starts nothing, because the store can't know their address. The user adds
 * it in the app's own form, and the checkout is started again with it.
 */
export interface NeedsAddress {
  readonly status: "needs_address";
  /** What the user calls the recipient ("Mom"); the form saves it under this label. */
  readonly label: string;
  /** The city the user mentioned for them, to prefill the form. */
  readonly cityHint: string | null;
  readonly startUrl: string;
  readonly store: string;
  readonly task: string | null;
  readonly maxCost: Money;
}

/**
 * A label that isn't saved but resembles saved ones ("Sarah" and "Sarah
 * Lee"). Nothing started: the model asks the user which they mean.
 */
export interface WhichAddress {
  readonly status: "which_address";
  readonly requested: string;
  readonly options: readonly ShipsTo[];
}

/** A create that started nothing: it needs an address, or to know which one. */
export type NotStarted = NeedsAddress | WhichAddress;

export function notStarted(
  value: CheckoutView | NotStarted,
): value is NotStarted {
  return value.status === "needs_address" || value.status === "which_address";
}

/**
 * What the model hears when nothing started, naming the tools to save an
 * address and start again. Never a street: there is none yet, or it stays saved.
 */
export function notStartedForModel(
  result: NotStarted,
  { start, save }: { readonly start: string; readonly save: string },
) {
  if (result.status === "which_address") {
    const options = result.options
      .map((option) => `"${option.label}" (${option.place})`)
      .join(" or ");
    return {
      status: result.status,
      requested: result.requested,
      options: result.options,
      next: `Nothing started: no saved address is labelled "${result.requested}", but ${options} may be it. Ask the user in one short line which they mean, then call ${start} again with addressLabel set to the saved label they pick. For someone or somewhere new, use a label that tells them apart.`,
    };
  }
  return {
    status: result.status,
    label: result.label,
    next: `Nothing started: "${result.label}" has no saved address. Ask the user in chat, in one short message, for what you don't already know: ${result.label}'s full name, a phone number and the street${result.cityHint ? ` in ${result.cityHint}` : ""}. Work out the city, postcode and country from the street and confirm them. Then ${save} with recipient "someone_else" and label "${result.label}", and call ${start} again with the same details, deliverTo "someone_else" and addressLabel "${result.label}".`,
  };
}

/** A saved address as the model and checkout views may see it: its label and "Miami, FL". */
export interface ShipsTo {
  readonly label: string;
  readonly place: string;
}

/** One saved address: a Crossmint buyer profile with its label. */
export interface SavedAddress {
  readonly id: string;
  readonly label: string;
  readonly place: string;
  readonly isDefault: boolean;
  readonly details: BuyerDetails;
}

/** Saved buyer facts for the signed-in user's agent, without provider metadata. */
export function addressesForModel(addresses: readonly SavedAddress[]) {
  return addresses.map(({ id, label, place, isDefault, details }) => ({
    id,
    label,
    place,
    default: isDefault,
    ...details,
  }));
}

/**
 * Where the user's default address is kept. Crossmint has no default flag on
 * buyer profiles, so the app stores the chosen profile ID. Only the user sets
 * it (null clears it); nothing picks one for them.
 */
export interface AddressDefaults {
  get(userId: string): Promise<string | null>;
  set(userId: string, buyerProfileId: string | null): Promise<void>;
}

export interface CheckoutsOptions {
  readonly api: CheckoutsApi;
  /** Absolute URL of the page where the owner completes payment or protected input for a run. */
  readonly actionUrl: (runId: string) => string;
  /** Attach one of the user's saved addresses (buyer profiles) to every new checkout. Default true. */
  readonly buyerProfiles?: boolean;
  /** The user's chosen default address: their own place. Without it, or when it is gone, there is none. */
  readonly addressDefaults?: AddressDefaults;
  /**
   * Give each user one persistent browser profile, created on their first checkout, so
   * store sign-ins and cookies carry over between checkouts. Default true.
   */
  readonly browserProfiles?: boolean;
}

function storeOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function time(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

/**
 * A store's "Select…" entry rather than a real choice. Stores don't always
 * flag it, so an empty value or a leading "Select"/"Choose" prompt counts too.
 */
function isPrompt(
  option: {
    disabled: boolean;
    placeholder: boolean;
    value: string;
    label: string;
  },
  index: number,
) {
  return (
    option.disabled ||
    option.placeholder ||
    !option.value.trim() ||
    (index === 0 &&
      /^(please )?(select|choose|pick)( (one|an? \w+|your \w+|\w+))?$/i.test(
        option.label
          .replace(/[^\p{L}\p{N} ]+/gu, " ")
          .replace(/\s+/g, " ")
          .trim(),
      ))
  );
}

const secretAutoComplete = new Set([
  "current-password",
  "new-password",
  "one-time-code",
]);

function field(item: FormField): QuestionField {
  const base = { key: item.key, label: item.label, required: item.required };
  switch (item.input.kind) {
    case "choice":
      return {
        ...base,
        kind: "choice",
        multiple: item.input.selection.kind === "many",
        options: item.input.options
          .filter((option, index) => !isPrompt(option, index))
          .map((option) => ({ value: option.value, label: option.label })),
      };
    case "text":
      return {
        ...base,
        kind: "text",
        ...(item.input.placeholder
          ? { placeholder: item.input.placeholder }
          : {}),
        ...(item.input.display === "masked" ||
        secretAutoComplete.has(item.input.autoComplete ?? "")
          ? { sensitive: true as const }
          : {}),
      };
    default:
      return { ...base, kind: item.input.kind };
  }
}

export function toView(
  run: Run,
  actionUrl: (runId: string) => string,
  shipsTo: ShipsTo | null = null,
) {
  let pending: CheckoutPending | null = null;
  if (run.status === "awaiting_input") {
    const { requestId, request } = run.requiredAction;
    const common = {
      requestId,
      question: request.question,
      expiresAt: time(request.expiresAt),
    };
    const interaction = request.interaction;
    if (interaction.kind === "payment") {
      pending = {
        ...common,
        kind: "payment",
        amount: {
          amount: interaction.amount.value,
          currency: interaction.amount.currency,
          exact: interaction.amount.kind === "exact",
        },
        merchant: {
          name: interaction.merchant.name,
          url: interaction.merchant.url,
          countryCode: interaction.merchant.countryCode,
        },
        actionUrl: actionUrl(run.runId),
      };
    } else if (
      interaction.fields.some((item) => item.handling === "protected")
    ) {
      pending = {
        ...common,
        kind: "protected",
        fields: interaction.fields,
        standard: interaction.fields
          .filter((item) => item.handling !== "protected")
          .map(field),
        actionUrl: actionUrl(run.runId),
      };
    } else {
      pending = {
        ...common,
        kind: "question",
        fields: interaction.fields.map(field),
      };
    }
  }
  let result: CheckoutView["result"] = null;
  if (
    run.status === "succeeded" ||
    run.status === "blocked" ||
    run.status === "cancelled" ||
    run.status === "failed"
  ) {
    const purchase =
      run.status === "succeeded" ? run.result.purchase : undefined;
    result = {
      summary: "result" in run ? run.result.summary : null,
      receipt:
        purchase?.kind === "receipt_captured"
          ? {
              total: purchase.receipt.total,
              merchantOrderId: purchase.receipt.merchantOrderId ?? null,
            }
          : null,
      confirmedWithoutReceipt: purchase?.kind === "confirmed_without_receipt",
      blockedCode: run.status === "blocked" ? run.result.code : null,
      failureReason: run.status === "failed" ? run.reason : null,
    };
  }
  return {
    runId: run.runId,
    revision: run.revision,
    status: run.status,
    createdAt: time(run.createdAt),
    startUrl: run.input.request.startUrl,
    store: storeOf(run.input.request.startUrl),
    task: run.input.request.task ?? null,
    maxCost: run.input.constraints.maxCost,
    usesSavedDetails: Boolean(run.input.buyerProfileId),
    fulfillment: fulfillmentOf(run.input.merchantGuidance),
    // A pickup still carries an address profile, for its contact details only.
    shipsTo:
      run.input.buyerProfileId &&
      fulfillmentOf(run.input.merchantGuidance) === "delivery"
        ? shipsTo
        : null,
    liveViewUrl: run.browser?.embedUrl ?? null,
    pending,
    progress: null,
    result,
  } satisfies CheckoutView;
}

/**
 * Hide capability URLs and progress from model context; the owner's UI still
 * receives the full view.
 */
export function forModel(view: CheckoutView) {
  const { liveViewUrl: _url, progress: _progress, ...rest } = view;
  return rest;
}

export function isSettled(view: CheckoutView) {
  return (
    view.status !== "queued" &&
    view.status !== "running" &&
    !(view.status === "awaiting_input" && view.pending === null)
  );
}

type Profile = AgentCheckoutBuyerProfileResponseDto;

/** Shown for profiles saved before addresses had labels. */
export const UNLABELED = "Saved address";

/** Where regional abbreviations read naturally ("Miami, FL"); elsewhere the country name does. */
const regionCountries = new Set(["US", "CA", "AU"]);

/** "Miami, FL" or "Paris, France": a city with its region or country, never the street. */
export function placeOf(shipping: BuyerDetails["shipping"]) {
  const region = shipping.administrativeAreaCode?.split("-")[1];
  if (region && regionCountries.has(shipping.countryCode)) {
    return `${shipping.locality}, ${region}`;
  }
  let country = shipping.countryCode;
  try {
    country =
      new Intl.DisplayNames(["en"], { type: "region" }).of(country) ?? country;
  } catch {
    // Unknown code: keep it as is.
  }
  return `${shipping.locality}, ${country}`;
}

/** Words that never tell two labels apart. */
const filler = new Set(["my", "our", "the", "address"]);

/** A label's words as compared: case, punctuation, a possessive "'s", "my", "the" and "address" don't matter. */
function labelWords(label: string) {
  return label
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word && !filler.has(word));
}

const labelKey = (label: string) => labelWords(label).join(" ");

const sameLabel = (a: string, b: string) => labelKey(a) === labelKey(b);

/**
 * The saved address a label names, by one rule: the same words, ignoring
 * case, punctuation, "my", "the", "'s" and "address" ("my partner" is
 * "Partner", "Mom's address" is "Mom"). A label that matches none but
 * shares all its words with some ("Sarah" and "Sarah Lee") is ambiguous: those
 * are the `similar` ones, and the user picks.
 */
export function matchLabel(
  addresses: readonly SavedAddress[],
  label: string,
): { match: SavedAddress | null; similar: SavedAddress[] } {
  const words = labelWords(label);
  const match =
    addresses.find((address) => sameLabel(address.label, label)) ?? null;
  if (match || !words.length) {
    return { match, similar: [] };
  }
  const similar = addresses.filter((address) => {
    const saved = labelWords(address.label);
    return (
      saved.length > 0 &&
      (words.every((word) => saved.includes(word)) ||
        saved.every((word) => words.includes(word)))
    );
  });
  return { match: null, similar };
}

/** Words that point at a person without naming them; never an address label. */
const pronouns = new Set([
  "her",
  "hers",
  "she",
  "him",
  "his",
  "he",
  "them",
  "their",
  "theirs",
  "they",
  "me",
  "mine",
  "us",
  "you",
  "yours",
]);

/** Whether a would-be label starts with a pronoun ("her", "his place"), which names nobody. */
export function isPronounLabel(label: string) {
  return pronouns.has(labelWords(label)[0] ?? "");
}

/**
 * The user's addresses, oldest first, with the default marked: the stored one
 * while it exists, else none. `profiles` is Crossmint's newest-first list.
 */
export function toAddresses(
  profiles: readonly Profile[],
  defaultId: string | null,
): SavedAddress[] {
  return profiles
    .map((profile) => {
      const id = String(profile.id);
      return {
        id,
        label: profile.label?.trim() || UNLABELED,
        place: placeOf(profile.shipping),
        isDefault: id === defaultId,
        details: details(profile),
      };
    })
    .reverse();
}

const quoted = (label: string) => `"${label.replace(/"/g, "'")}"`;

/** What a checkout ships to, decided before anything starts. */
type Shipping =
  | {
      readonly status: "start";
      readonly buyer: SavedAddress | null;
    }
  | NotStarted;

/**
 * Which saved address a new checkout attaches. The whole address model in one place (docs/ADDRESSES.md):
 * only a delivery to someone with no saved address stops to ask.
 */
export function planShipping(
  addresses: readonly SavedAddress[],
  input: {
    readonly fulfillment: Fulfillment;
    readonly deliverTo?: DeliverTo;
    readonly addressLabel?: string;
    readonly cityHint?: string;
    readonly startUrl: string;
    readonly task?: string;
    readonly maxCost: Money;
  },
): Shipping {
  const own = addresses.find((address) => address.isDefault) ?? null;
  // Pickups and orders that don't ship use the user's own address only for
  // its name, email and phone.
  if (input.fulfillment !== "delivery") {
    return { status: "start", buyer: own };
  }
  const to = input.deliverTo ?? "me";
  if (to === "store_account") {
    return { status: "start", buyer: null };
  }
  // A pronoun names nobody: "to me" is the user's default, "her" is an error.
  const raw = input.addressLabel?.trim() ?? "";
  const label = labelKey(raw) && !isPronounLabel(raw) ? raw : "";
  if (to === "someone_else" && !label) {
    const saved = addresses.map((address) => quoted(address.label)).join(", ");
    throw new CheckoutError(
      `deliverTo "someone_else" needs addressLabel: that person's saved label${saved ? ` (saved: ${saved})` : ""}, or what the user calls them, like "Mom". Never a pronoun like "her".`,
      "address_label",
      400,
    );
  }
  if (!label) {
    return { status: "start", buyer: own };
  }
  const { match, similar } = matchLabel(addresses, label);
  if (match) {
    return { status: "start", buyer: match };
  }
  if (similar.length) {
    return {
      status: "which_address",
      requested: label,
      options: similar.map(shipsToOf),
    };
  }
  if (to === "me") {
    // An own place that isn't saved: the store account or the store has it.
    return { status: "start", buyer: null };
  }
  return {
    status: "needs_address",
    label,
    cityHint: input.cityHint?.trim() || null,
    startUrl: input.startUrl,
    store: storeOf(input.startUrl),
    task: input.task ?? null,
    maxCost: input.maxCost,
  };
}

/** The display-safe part of an address, for checkout views and the model. */
export function shipsToOf(address: Pick<SavedAddress, "label" | "place">) {
  return { label: address.label, place: address.place } satisfies ShipsTo;
}

function details(profile: Profile): BuyerDetails {
  const { name, contact, shipping } = profile;
  const email = typeof contact?.email === "string" ? contact.email : null;
  return {
    ...(name ? { name } : {}),
    ...(contact
      ? {
          contact: {
            ...(email ? { email } : {}),
            ...(contact.phone ? { phone: contact.phone } : {}),
          },
        }
      : {}),
    shipping,
  };
}

function unwrap<T>(response: {
  data?: T;
  error?: unknown;
  response?: Response;
}): T {
  if (response.data !== undefined) {
    return response.data;
  }
  const error = response.error as
    | { message?: unknown; code?: unknown }
    | undefined;
  const message =
    typeof error?.message === "string" && error.message.length < 500
      ? error.message
      : "Crossmint did not return a result.";
  throw new CheckoutError(
    message,
    typeof error?.code === "string" ? error.code : null,
    response.response?.status ?? null,
  );
}

/** Where the checkout browser should appear from, for a valid ISO 3166-1 alpha-2 code. */
export function browserLocation(country: string | null | undefined) {
  const code = country?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code)
    ? { type: "country" as const, countryCode: code }
    : null;
}

/** A create refused for its browser location (a 400 validation error that names it). */
export function rejectsLocation(created: {
  error?: unknown;
  response?: Response;
}) {
  if (created.response?.status !== 400 || created.error === undefined) {
    return false;
  }
  let detail: string;
  try {
    detail = JSON.stringify(created.error);
  } catch {
    return false;
  }
  return /browser|location/i.test(detail);
}

type MessagePart = Parameters<
  CheckoutsApi["messages"]["create"]
>[0]["body"]["parts"][0];
type FormAnswers = Extract<
  Extract<MessagePart, { action: "submit" }>["response"],
  { kind: "form" }
>["answers"];

/** Message pages read per refresh, and runs whose progress an instance remembers. */
const PROGRESS_PAGES = 5;
const PROGRESS_RUNS = 500;

/** Every call acts as one Crossmint user; callers derive `userId` from a verified session. */
export function createCheckouts({
  api,
  actionUrl,
  buyerProfiles = true,
  addressDefaults,
  browserProfiles = true,
}: CheckoutsOptions) {
  const as = (userId: string) => {
    if (!userId) {
      throw new CheckoutError("Sign in to use checkouts.");
    }
    return { "x-crossmint-user-id": userId };
  };
  /** The user's buyer profiles, newest first. Crossmint has no per-user cap; one page of 100 is plenty. */
  async function profiles(userId: string) {
    const page = unwrap(
      await api.buyerProfiles.list({
        headers: as(userId),
        query: { limit: 100 },
      }),
    );
    return page.data;
  }
  async function addresses(userId: string) {
    if (!buyerProfiles) {
      return [];
    }
    const [list, defaultId] = await Promise.all([
      profiles(userId),
      addressDefaults ? addressDefaults.get(userId) : null,
    ]);
    return toAddresses(list, defaultId);
  }
  /**
   * Labels for the runs' addresses, read once per call. A failed read only
   * costs the "Ships to" line, never the checkout itself.
   */
  async function shipsToByProfile(userId: string, runs: readonly Run[]) {
    const byId = new Map<string, ShipsTo>();
    if (!buyerProfiles || !runs.some((run) => run.input.buyerProfileId)) {
      return byId;
    }
    try {
      for (const address of toAddresses(await profiles(userId), null)) {
        byId.set(address.id, shipsToOf(address));
      }
    } catch {
      // Leave it empty.
    }
    return byId;
  }
  const viewOf = (run: Run, byId: ReadonlyMap<string, ShipsTo>) =>
    toView(
      run,
      actionUrl,
      byId.get(String(run.input.buyerProfileId ?? "")) ?? null,
    );
  /**
   * Each active run's messages read so far, per user, so a refresh reads only
   * what is new since its cursor (one Crossmint call). A cold instance reads
   * from the start, a few pages at most per refresh.
   */
  const logs = new Map<string, { cursor: string | null; log: ProgressLog }>();
  async function progressLog(
    userId: string,
    run: Run,
  ): Promise<ProgressLog | null> {
    const key = `${userId}\n${run.runId}`;
    const cached = logs.get(key);
    // Ended runs read nothing more.
    if (
      run.status !== "queued" &&
      run.status !== "running" &&
      run.status !== "awaiting_input"
    ) {
      return cached?.log ?? null;
    }
    let { cursor, log } = cached ?? { cursor: null, log: emptyLog };
    try {
      for (let page = 0; page < PROGRESS_PAGES; page++) {
        const read = messagesPage.parse(
          unwrap(
            await api.messages.list({
              headers: as(userId),
              path: { id: run.runId },
              query: { limit: 100, ...(cursor ? { cursor } : {}) },
            }),
          ),
        );
        log = foldMessages(log, read.data);
        cursor = read.streamCursor ?? read.nextCursor ?? cursor;
        if (!read.nextCursor) {
          break;
        }
      }
    } catch {
      // Progress is optional. Forget the cursor in case it went stale.
      logs.delete(key);
      return null;
    }
    logs.delete(key);
    logs.set(key, { cursor, log });
    if (logs.size > PROGRESS_RUNS) {
      logs.delete(logs.keys().next().value ?? "");
    }
    return log;
  }
  async function browserProfile(userId: string) {
    const page = unwrap(
      await api.browserProfiles.list({
        headers: as(userId),
        query: { limit: 1 },
      }),
    );
    return page.data[0] ?? null;
  }
  /**
   * The user's browser profile, created on first use. Crossmint allows one per user, and a
   * cleared profile blocks a new one (409) until its erasure finishes; checkouts started
   * meanwhile run without saved sign-ins.
   */
  async function ensureBrowserProfile(userId: string) {
    const existing = await browserProfile(userId);
    if (existing) {
      return String(existing.id);
    }
    const created = await api.browserProfiles.create({
      headers: as(userId),
      body: {},
    });
    if (created.response?.status === 409) {
      const raced = await browserProfile(userId);
      return raced ? String(raced.id) : null;
    }
    return String(unwrap(created).id);
  }
  return {
    /**
     * Start a checkout with the address `planShipping` picks. Only a delivery
     * to someone with no saved address (`needs_address`), or a label that
     * could be several (`which_address`), starts nothing.
     */
    async create(
      userId: string,
      input: {
        startUrl: string;
        task?: string;
        maxCost: Money;
        /** Default "delivery". */
        fulfillment?: Fulfillment;
        /** For a delivery: whom it's for. Default "me". */
        deliverTo?: DeliverTo;
        /** A saved address's label, or for someone new what the user calls them. */
        addressLabel?: string;
        /** For someone new: the city the user mentioned, to prefill the form. */
        cityHint?: string;
        /**
         * ISO 3166-1 alpha-2 country the checkout browser should appear from
         * (where the user or the delivery is). Defaults to the attached
         * address's country.
         */
        country?: string;
      },
    ): Promise<CheckoutView | NotStarted> {
      const fulfillment = input.fulfillment ?? "delivery";
      // Addresses decide first, so a checkout that can't go starts nothing.
      const plan = buyerProfiles
        ? planShipping(await addresses(userId), { ...input, fulfillment })
        : ({ status: "start", buyer: null } as const);
      if (plan.status !== "start") {
        return plan;
      }
      const { buyer } = plan;
      const browser = browserProfiles
        ? await ensureBrowserProfile(userId)
        : null;
      const location = browserLocation(
        input.country ?? buyer?.details.shipping.countryCode,
      );
      const body = (withLocation: boolean) => {
        const browserRequest = {
          ...(browser ? { profileId: browser } : {}),
          ...(withLocation && location ? { location } : {}),
        };
        return {
          request: {
            startUrl: input.startUrl,
            ...(input.task ? { task: input.task } : {}),
          },
          constraints: { maxCost: input.maxCost },
          ...(buyer ? { buyerProfileId: buyer.id } : {}),
          ...(Object.keys(browserRequest).length
            ? { browser: browserRequest }
            : {}),
        };
      };
      let created = await api.create({
        headers: as(userId),
        body: body(true),
      });
      // Crossmint may not accept a browser location yet. A checkout must never
      // fail over it: start once more without it.
      if (location && rejectsLocation(created)) {
        console.warn(
          "Crossmint refused the checkout browser location; starting without it.",
        );
        created = await api.create({ headers: as(userId), body: body(false) });
      }
      const run = unwrap(created);
      return toView(run, actionUrl, buyer ? shipsToOf(buyer) : null);
    },
    /** The user's saved addresses, oldest first, with the default marked. */
    addresses,
    /**
     * Create an address, or replace one by ID. Labels are unique per user (as
     * `matchLabel` compares them). It becomes the default only with
     * `makeDefault`: the forms offer that for the user's own places, so
     * someone else's address never becomes the default by itself.
     */
    async saveAddress(
      userId: string,
      input: {
        id?: string;
        label: string;
        details: BuyerDetails;
        makeDefault?: boolean;
      },
    ): Promise<{ id: string; addresses: SavedAddress[] }> {
      const current = await addresses(userId);
      if (input.id && !current.some((address) => address.id === input.id)) {
        throw new CheckoutError("That address doesn't exist.", null, 404);
      }
      if (
        current.some(
          (address) =>
            address.id !== input.id && sameLabel(address.label, input.label),
        )
      ) {
        throw new CheckoutError(
          `You already have an address labelled "${input.label.trim()}".`,
          "duplicate_label",
          400,
        );
      }
      const { name, contact, shipping } = input.details;
      // `name` and `contact` replace the stored block; `shipping` merges per field, so a
      // cleared optional address field is sent as null.
      const body = {
        label: input.label.trim(),
        name: name ?? {},
        contact: contact ?? {},
        shipping: {
          ...shipping,
          administrativeAreaCode: shipping.administrativeAreaCode ?? null,
          postalCode: shipping.postalCode ?? null,
        },
      };
      const saved = unwrap(
        input.id
          ? await api.buyerProfiles.update({
              headers: as(userId),
              path: { id: input.id },
              body,
            })
          : await api.buyerProfiles.create({ headers: as(userId), body }),
      );
      const id = String(saved.id);
      if (input.makeDefault && addressDefaults) {
        await addressDefaults.set(userId, id);
      }
      return { id, addresses: await addresses(userId) };
    },
    /** Make an address the default, or (`isDefault` false) stop it being the default, leaving none. */
    async setDefaultAddress(userId: string, id: string, isDefault = true) {
      if (!addressDefaults) {
        throw new CheckoutError("Default addresses aren't available here.");
      }
      const current = await addresses(userId);
      const address = current.find((item) => item.id === id);
      if (!address) {
        throw new CheckoutError("That address doesn't exist.", null, 404);
      }
      if (!isDefault && !address.isDefault) {
        return current;
      }
      await addressDefaults.set(userId, isDefault ? id : null);
      return current.map((item) => ({
        ...item,
        isDefault: isDefault && item.id === id,
      }));
    },
    /** Delete an address. If it was the default, there is none until the user picks one. */
    async deleteAddress(userId: string, id: string) {
      const result = await api.buyerProfiles.delete({
        headers: as(userId),
        path: { id },
      });
      if (result.error !== undefined) {
        unwrap(result);
      }
      return addresses(userId);
    },
    /** Whether checkouts keep the user's store sign-ins (they have a browser profile). */
    async hasSavedSignIns(userId: string) {
      return (await browserProfile(userId)) !== null;
    },
    /** Sign the user out of every store: Crossmint erases their browser profile. */
    async clearSignIns(userId: string) {
      const profile = await browserProfile(userId);
      if (!profile) {
        return;
      }
      const result = await api.browserProfiles.delete({
        headers: as(userId),
        path: { id: String(profile.id) },
      });
      if (result.error !== undefined) {
        unwrap(result);
      }
    },
    /**
     * One run as the user may see it. `progress` also reads the run's new
     * messages (one more Crossmint call while it is active), for the UI.
     */
    async get(
      userId: string,
      runId: string,
      options: { progress?: boolean } = {},
    ): Promise<CheckoutView> {
      const run = unwrap(
        await api.get({ headers: as(userId), path: { id: runId } }),
      );
      const [byId, log] = await Promise.all([
        shipsToByProfile(userId, [run]),
        options.progress ? progressLog(userId, run) : null,
      ]);
      const view = viewOf(run, byId);
      return log ? { ...view, progress: progressOf(log) } : view;
    },
    /**
     * The user's runs, newest first. `progress` also reads the new messages of
     * each active run (one more call per active run), for a UI listing them.
     */
    async list(
      userId: string,
      query: { cursor?: string; limit?: number },
      options: { progress?: boolean } = {},
    ) {
      const page = unwrap(await api.list({ headers: as(userId), query }));
      const [byId, logs] = await Promise.all([
        shipsToByProfile(userId, page.data),
        options.progress
          ? Promise.all(page.data.map((run) => progressLog(userId, run)))
          : null,
      ]);
      return {
        runs: page.data.map((run, index) => {
          const view = viewOf(run, byId);
          const log = logs?.[index];
          return log ? { ...view, progress: progressOf(log) } : view;
        }),
        nextCursor: page.nextCursor ?? null,
      };
    },
    /**
     * How this request was answered, read from the run's messages on Crossmint
     * so every instance agrees: "payment" (an order intent was submitted;
     * Crossmint doesn't say which), "other" (a form, a decline or an
     * alternative), or null when nobody answered it yet. Throws when the
     * messages can't be read in full; a caller deciding whether to pay must
     * treat that as answered.
     */
    async answer(
      userId: string,
      runId: string,
      requestId: string,
    ): Promise<"payment" | "other" | null> {
      let cursor: string | null = null;
      // Oldest first; a run with more than this many pages counts as unreadable.
      for (let page = 0; page < 10; page++) {
        const read: AgentCheckoutMessageListResponseDto = unwrap(
          await api.messages.list({
            headers: as(userId),
            path: { id: runId },
            query: { limit: 100, ...(cursor ? { cursor } : {}) },
          }),
        );
        for (const message of read.data ?? []) {
          for (const part of message.parts ?? []) {
            if (
              part.type === "input_response" &&
              part.requestId === requestId
            ) {
              return part.action === "submit" &&
                part.response.kind === "payment"
                ? "payment"
                : "other";
            }
          }
        }
        if (!read.nextCursor) {
          return null;
        }
        cursor = read.nextCursor;
      }
      throw new CheckoutError("Couldn't read the checkout's messages.");
    },
    async respond(
      userId: string,
      runId: string,
      messageId: string,
      part:
        | { requestId: string; answers: Record<string, unknown> }
        | { requestId: string; orderIntentId: string }
        | { requestId: string; decline: true }
        | { requestId: string; alternative: string },
    ) {
      const response: MessagePart =
        "decline" in part
          ? {
              type: "input_response",
              action: "decline",
              requestId: part.requestId,
            }
          : "alternative" in part
            ? {
                type: "input_response",
                action: "alternative",
                requestId: part.requestId,
                text: part.alternative,
              }
            : {
                type: "input_response",
                action: "submit",
                requestId: part.requestId,
                response:
                  "orderIntentId" in part
                    ? { kind: "payment", orderIntentId: part.orderIntentId }
                    : { kind: "form", answers: part.answers as FormAnswers },
              };
      return unwrap(
        await api.messages.create({
          headers: as(userId),
          path: { id: runId },
          body: { id: messageId, parts: [response] },
        }),
      );
    },
    /**
     * A plain instruction for the checkout's browser agent ("use standard shipping"),
     * with or without a question open. An open request takes the instruction
     * as an alternative response; plain text is rejected while it is open.
     */
    async steer(
      userId: string,
      runId: string,
      messageId: string,
      text: string,
      // Eve snapshots this in a durable step. Undefined targets the current
      // request for a new MCP call; null pins a plain-text instruction.
      requestId?: string | null,
    ) {
      if (requestId === undefined) {
        const run = unwrap(
          await api.get({ headers: as(userId), path: { id: runId } }),
        );
        if (
          run.status !== "queued" &&
          run.status !== "running" &&
          run.status !== "awaiting_input"
        ) {
          throw new CheckoutError(
            "That checkout has ended. Start a new one if the user wants to try again.",
          );
        }
        requestId =
          run.status === "awaiting_input" ? run.requiredAction.requestId : null;
      }
      const part: MessagePart =
        requestId !== null
          ? {
              type: "input_response",
              action: "alternative",
              requestId,
              text,
            }
          : { type: "text", text };
      // Retrying the same payload keeps its ID; a different request or payload
      // type must not reuse an ID Crossmint already accepted.
      const hash = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify([messageId, part])),
      );
      const hex = Array.from(new Uint8Array(hash), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
      return unwrap(
        await api.messages.create({
          headers: as(userId),
          path: { id: runId },
          body: { id, parts: [part] },
        }),
      );
    },
    async cancel(userId: string, runId: string) {
      return unwrap(
        await api.cancel({ headers: as(userId), path: { id: runId } }),
      );
    },
  };
}

export type Checkouts = ReturnType<typeof createCheckouts>;
