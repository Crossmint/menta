/**
 * The Menta checkout card: an MCP Apps view (SEP-1865) that MCP Apps hosts
 * render for our checkout tools; only the local dev host gets it. It is drawn
 * with the web app's own checkout components (`src/ui`, React on Preact here)
 * and Tailwind on the same tokens, so the card and the web chat's dock are one
 * design. It talks to the host over the bridge in ./bridge.ts.
 *
 * A checkout is a conversation: show_checkout_step draws one card for each
 * step the user takes (a store question, the payment, private details) and
 * for the receipt. Each card is pinned to its step: once the user acts in it,
 * or the checkout moves on, it settles (the question and the answer, "Sent
 * securely", "Approved"), and only the newest card for a step is live. If
 * the checkout stops, a step card keeps what it showed. Cards for the same run find each other on a
 * BroadcastChannel; the newest one polls and shares what it reads.
 *
 * Private store fields: where the server offers it and the host allows
 * Crossmint's frames, the card loads Crossmint's own components from our
 * origin (secure-entry.tsx) and the user finishes the step right here; the
 * card only ever handles the resulting protectedInputIds, sent through an
 * app-only tool. Anything that gets in the way (CSP, an origin Crossmint
 * doesn't allow, a timeout) falls back to the link to our signed-in secure
 * page (/checkouts/<runId>). A payment links to the spending limit request
 * page (/spending-limit/<token>).
 */

import type {
  McpUiDisplayMode,
  McpUiHostContext,
  McpUiInitializeResult,
} from "@modelcontextprotocol/ext-apps";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { shortTask } from "../src/task.js";
import type { Draft, FormEntry } from "../src/ui/answers.js";
import { money } from "../src/ui/format.js";
import { UiLocaleProvider, useUi } from "../src/ui/i18n/context.js";
import { sentences, type Ui, uiFor } from "../src/ui/i18n/index.js";
import { Arrow, Check, Shield } from "../src/ui/icons.js";
import { PoweredByCrossmint, Settled } from "../src/ui/payment.js";
import { RequestForm, type Submission } from "../src/ui/question.js";
import { blockedReason, type Tone } from "../src/ui/status.js";
import { listen, notify, request } from "./bridge.js";
import {
  answeredContext,
  answerSummary,
  asksForAddress,
  asksWhichAddress,
  assistantOnly,
  autoFullscreen,
  type Checkout,
  cardLocale,
  type DiagnosticReason,
  type DisplayMode,
  describe,
  HOST_COLORS,
  hostModes,
  isActive,
  isCurrent,
  keepsLastState,
  modeOffers,
  onMobile,
  outcomeLine,
  type Pending,
  type Pinned,
  paidOf,
  paidOnMentaMessage,
  paidPast,
  parseCredentials,
  parseResult,
  passedStep,
  progressLine,
  refreshedContext,
  type SecureEvent,
  type SecureState,
  type Snapshot,
  safeActionUrl,
  safeArea,
  savedSaid,
  secretTitle,
  secureDoneContext,
  secureStep,
  settledLine,
  stallReason,
  startSecureStep,
  stateKey,
  stepDoneMessage,
  stepKey,
  storeBrand,
  storeSite,
  toolError,
  UNSHOWN_STEP_MS,
  unconfirmed,
} from "./model.js";
import type {
  OcaSecure,
  ProtectedMount,
  SecureCredentials,
} from "./secure-api.js";

declare const __OCA_SECURE_VERSION__: string;
declare const __OCA_FONTS__: { readonly sans: string; readonly mono: string };

/** ChatGPT's Apps SDK globals, used only as feature-detected fallbacks. */
interface OpenAiGlobals {
  readonly displayMode?: string;
  readonly theme?: string;
  readonly requestDisplayMode?: (args: {
    mode: McpUiDisplayMode;
  }) => Promise<{ mode?: string } | undefined>;
  readonly openExternal?: (args: { href: string }) => void;
  /** ChatGPT keeps a frame at its tallest unless told the content shrank. */
  readonly notifyIntrinsicHeight?: (height: number) => void;
  readonly callTool?: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
  readonly sendFollowUpMessage?: (args: { prompt: string }) => Promise<void>;
  /** ChatGPT's device hints (`device.type` is "mobile" on phones). */
  readonly userAgent?: unknown;
  readonly widgetState?: unknown;
  /** The user's language (BCP 47), when the host has no `hostContext.locale`. */
  readonly locale?: unknown;
  readonly setWidgetState?: (state: unknown) => Promise<void> | void;
}
declare global {
  interface Window {
    readonly openai?: OpenAiGlobals;
  }
}

const POLL_MS = 4000;
/** Crossmint's frame must answer within this long, or the step links out. */
const SECURE_LOAD_MS = 15_000;
/** Stop polling after this long without a change; the user can resume. */
const IDLE_MS = 20 * 60_000;
/** A card that isn't the newest reads the run itself only this rarely. */
const FOLLOWER_POLL_MS = 30_000;
/** Polls slow down this much while the card is out of view. */
const HIDDEN_SLOWDOWN = 5;
const PROTOCOL_VERSION = "2026-01-26";

const html = document.documentElement;
const mountPoint = document.getElementById("card") as HTMLElement;
const origin =
  document.querySelector<HTMLMetaElement>('meta[name="oca-origin"]')?.content ??
  "";
const instanceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// ---------------------------------------------------------------------------
// State. Module-level, like the host bridge; every change calls update(),
// which draws <App /> again (Preact keeps each component's own state).

type Theme = "light" | "dark";

/** A line the card shows, written in the language it is drawn in. */
type Line = (ui: Ui) => string;

/**
 * ChatGPT keeps a card's state across reloads; elsewhere it lasts the page.
 * Read back with `savedSaid`, which also reads cards saved as `done`.
 */
interface WidgetState {
  /** What the user answered in this step card, as they saw it ("Feather wand"). */
  readonly said?: string;
}

interface Peer {
  readonly born: number;
  readonly step: string;
  readonly role: Pinned["role"];
}

const S = {
  context: {} as McpUiHostContext,
  theme: "light" as Theme,
  canCallTools: false,
  initialized: false,
  /** ui/initialize settled, either way: the card knows whether it can follow the checkout. */
  bridgeKnown: false,
  hostCanMessage: false,
  hostName: "",
  advertisedTools: false,
  /** ChatGPT, by its own API or its name. */
  onChatGpt: typeof window.openai === "object" && window.openai !== null,
  viaOpenAi: false,
  /** The run as last read. */
  snapshot: null as Snapshot | null,
  /**
   * The last read shown while the run was active (any: its tool result, its
   * polls, a newer card's shared reads): a stopped run's step card keeps
   * showing it, so an older card stays as the newest reads left it.
   */
  lastActive: null as Snapshot | null,
  /**
   * One of this card's own reads (its polls, an answer's result) found the
   * run active. Never the tool result the card was drawn from, nor a peer's
   * hand-off (which can be its tool result), so a card replayed after the
   * checkout stopped (a reload, an old conversation) settles instead of
   * keeping its last state.
   */
  seenActive: false,
  /** What this card was drawn for. */
  pin: null as Pinned | null,
  /** When the tool result that created this card was read; newer cards win. */
  born: 0,
  /** The run left this card's step while still active. */
  moved: false,
  /** Other cards for this run, by instance. */
  peers: new Map<string, Peer>(),
  /** The user asked to see a step no card showed, here. */
  expandedFor: null as string | null,
  /** When the run first needed the user for a step no card shows. */
  unshownSince: null as { step: string; at: number } | null,
  tornDown: false,
  paused: false,
  /** Why there's no checkout to show, if something went wrong. */
  problem: null as Line | null,
  error: null as Line | null,
  /** The language the assistant writes in, from a show result; kept once set. */
  assistantLocale: null as string | null,
  /** The language the host sent with a tool call, from a result's `_meta`; kept once set. */
  resultLocale: null as string | null,
  failures: 0,
  lastChange: Date.now(),
  lastRead: Date.now(),
  /** The state the model last heard about, so it is told only about changes. */
  reported: "",
  /** What the user answered here, kept so later context updates still say it. */
  answerNote: "",
  /** What was sent for each request from this card: its form shows it locked. */
  sent: new Map<string, Record<string, Draft>>(),
  /**
   * A read of the run, after this card loaded, still had its payment open: a
   * card replayed after the payment (a reload, an old conversation) never
   * says it was paid.
   */
  paymentSeenOpen: false,
  /** This card asked whether its payment was paid (once, to say it once). */
  paidAsked: false,
  secureOffered: false,
  visible: true,
  timer: undefined as ReturnType<typeof setTimeout> | undefined,
  /** The request the card already asked fullscreen for, on a phone. */
  autoExpandedFor: null as string | null,
  diagnosed: new Set<DiagnosticReason>(),
};

const root = createRoot(mountPoint);
let drawScheduled = false;
function update() {
  if (drawScheduled) {
    return;
  }
  drawScheduled = true;
  queueMicrotask(() => {
    drawScheduled = false;
    const ui = cardUi();
    html.lang = ui.tag;
    root.render(
      <UiLocaleProvider locale={ui.locale}>
        <App />
      </UiLocaleProvider>,
    );
  });
}

/**
 * The card's language (model.ts `cardLocale`): the assistant's, the host
 * context's, ChatGPT's own, the request's, the browser's; English without any.
 */
function cardUi(): Ui {
  return uiFor(
    cardLocale({
      assistant: S.assistantLocale,
      hostContext: S.context.locale,
      openAi: window.openai?.locale,
      request: S.resultLocale,
      browser: typeof navigator === "object" ? navigator.language : undefined,
    }),
  );
}

/** Keeps the language a result carried; a result without one changes nothing. */
function keepLocale(snapshot: Snapshot) {
  if (snapshot.localeFromAssistant) {
    S.assistantLocale = snapshot.locale;
  } else if (snapshot.locale) {
    S.resultLocale = snapshot.locale;
  }
}

function widgetState(): WidgetState {
  const value = window.openai?.widgetState;
  return value && typeof value === "object" ? (value as WidgetState) : {};
}

function keepWidgetState(next: WidgetState) {
  try {
    void window.openai?.setWidgetState?.({ ...widgetState(), ...next });
  } catch {
    // Not ChatGPT; the card just won't remember after a reload.
  }
}

// ---------------------------------------------------------------------------
// Host messages.

listen({
  onRequest(method) {
    if (method === "ui/resource-teardown") {
      S.tornDown = true;
      stopPolling();
      say({ kind: "bye" });
      channel?.close();
      return {};
    }
    return method === "ping" ? {} : null;
  },
  onNotification(method, params) {
    if (method === "ui/notifications/tool-result") {
      receiveToolResult(params);
    } else if (method === "ui/notifications/tool-cancelled") {
      if (!S.snapshot) {
        S.problem = (ui) => ui.m.card.nothingToShow;
        update();
      }
    } else if (method === "ui/notifications/host-context-changed") {
      if (params && typeof params === "object") {
        S.context = { ...S.context, ...(params as McpUiHostContext) };
        applyContext();
        // The host's own API may have come up since initialize.
        if (!S.canCallTools && S.bridgeKnown && detectTools()) {
          onToolsReady();
        }
        update();
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Cards for the same run: who else shows it, and which one leads. The newest
// card polls and shares each read; the others follow. Hosts serve every card
// of this server from one sandbox origin, so a BroadcastChannel reaches them.
// Where it doesn't, each card reads on its own.

type Note =
  | {
      kind: "hello";
      runId: string;
      id: string;
      born: number;
      step: string;
      role: Pinned["role"];
      reply: boolean;
    }
  | { kind: "bye"; runId: string; id: string }
  | { kind: "state"; runId: string; id: string; snapshot: Snapshot };

const channel = (() => {
  try {
    return new BroadcastChannel("oca-checkout-card");
  } catch {
    return null;
  }
})();

type Say =
  | { kind: "hello"; reply: boolean }
  | { kind: "bye" }
  | { kind: "state"; snapshot: Snapshot };

function say(note: Say) {
  const runId = S.snapshot?.checkout.runId;
  if (!channel || !runId || !S.pin) {
    return;
  }
  try {
    if (note.kind === "hello") {
      channel.postMessage({
        kind: "hello",
        runId,
        id: instanceId,
        born: S.born,
        step: S.pin.step,
        role: S.pin.role,
        reply: note.reply,
      } satisfies Note);
    } else if (note.kind === "bye") {
      channel.postMessage({ kind: "bye", runId, id: instanceId });
    } else {
      channel.postMessage({
        kind: "state",
        runId,
        id: instanceId,
        snapshot: note.snapshot,
      } satisfies Note);
    }
  } catch {
    // A closed channel: this card is going away.
  }
}

function newer(
  a: { born: number; id: string },
  b: { born: number; id: string },
) {
  return a.born > b.born || (a.born === b.born && a.id > b.id);
}

/** This card is the newest for its run: it polls and tells the model. */
function isLeader() {
  for (const [id, peer] of S.peers) {
    if (newer({ born: peer.born, id }, { born: S.born, id: instanceId })) {
      return false;
    }
  }
  return true;
}

function peerFacts() {
  let earlierSameStep = false;
  for (const [id, peer] of S.peers) {
    if (
      !newer({ born: peer.born, id }, { born: S.born, id: instanceId }) &&
      peer.role === "step" &&
      S.pin?.role === "step" &&
      peer.step === S.pin.step
    ) {
      earlierSameStep = true;
    }
  }
  return { earlierSameStep };
}

/** Whether some card for this run was drawn for this step. */
function stepShown(step: string) {
  if (S.pin?.step === step && S.pin.role === "step") {
    return true;
  }
  for (const peer of S.peers.values()) {
    if (peer.role === "step" && peer.step === step) {
      return true;
    }
  }
  return false;
}

if (channel) {
  channel.onmessage = (event: MessageEvent) => {
    const note = event.data as Note | null;
    const runId = S.snapshot?.checkout.runId;
    if (
      !note ||
      !runId ||
      note.runId !== runId ||
      typeof note.id !== "string" ||
      note.id === instanceId
    ) {
      return;
    }
    const wasLeader = isLeader();
    if (note.kind === "hello") {
      if (typeof note.born !== "number" || typeof note.step !== "string") {
        return;
      }
      const known = S.peers.has(note.id);
      S.peers.set(note.id, {
        born: note.born,
        step: note.step,
        role: note.role === "start" ? "start" : "step",
      });
      if (!known && !note.reply) {
        say({ kind: "hello", reply: true });
      }
      if (wasLeader && S.snapshot && !isLeader()) {
        // A newer card took over: hand it what we know.
        say({ kind: "state", snapshot: S.snapshot });
      }
    } else if (note.kind === "bye") {
      S.peers.delete(note.id);
    } else if (note.kind === "state" && note.snapshot?.checkout) {
      if ((note.snapshot.observedAt ?? 0) >= (S.snapshot?.observedAt ?? 0)) {
        S.lastRead = Date.now();
        show(note.snapshot);
      }
    }
    if (wasLeader !== isLeader()) {
      schedule();
    }
    update();
  };
}

// ---------------------------------------------------------------------------
// Data flow.

/** A failed tool call's message (the server writes it for people), shortened. */
function failureText(params: unknown) {
  const text = toolError(params, cardUi());
  if (!text) {
    return "";
  }
  const line = text.trim().split("\n")[0] ?? "";
  return line.length > 180 ? `${line.slice(0, 179)}…` : line;
}

function receiveToolResult(params: unknown) {
  const next = parseResult(params, origin);
  if (!next) {
    const failed = failureText(params);
    S.problem = S.snapshot
      ? null
      : asksWhichAddress(params)
        ? (ui) => ui.m.card.whichAddress
        : asksForAddress(params)
          ? (ui) => ui.m.card.whereTo
          : failed
            ? (ui) => ui.f(ui.m.card.didntStart, { reason: failed })
            : (ui) => ui.m.card.cantShow;
    update();
    return;
  }
  if (S.snapshot && next.checkout.runId !== S.snapshot.checkout.runId) {
    return;
  }
  const first = !S.pin;
  S.born = next.observedAt || Date.now();
  S.lastRead = Date.now();
  S.reported = stateKey(next.checkout);
  if (first) {
    const role = next.role ?? "step";
    S.pin = {
      role,
      step:
        role === "start" && isActive(next.checkout)
          ? "working"
          : stepKey(next.checkout),
      pending: role === "start" ? null : next.checkout.pending,
      said: role === "step" ? savedSaid(widgetState()) : null,
    };
  }
  show(next);
  say({ kind: "hello", reply: false });
  schedule();
}

/**
 * What counts as a change for the idle pause. Not the step's link: a payment's
 * spending limit request link is sealed anew on every read.
 */
function changeKey(snapshot: Snapshot) {
  return JSON.stringify([snapshot.checkout, snapshot.progress], (key, value) =>
    key === "actionUrl" ? undefined : value,
  );
}

/** A read this card made itself, after it loaded. */
function readOwn(next: Snapshot) {
  S.seenActive ||= isActive(next.checkout);
}

/** Puts a newer read of the run on screen. */
function show(next: Snapshot) {
  const before = S.snapshot;
  S.snapshot = next;
  if (isActive(next.checkout)) {
    S.lastActive = next;
  }
  S.problem = null;
  keepLocale(next);
  S.secureOffered ||= next.secureStep;
  const step = stepKey(next.checkout);
  if (S.pin && step !== S.pin.step && step !== "end") {
    S.moved = true;
  }
  tellIfPaidOnMenta(next.checkout);
  if (!before || changeKey(before) !== changeKey(next)) {
    S.lastChange = Date.now();
  }
  // A step the store opened that no card shows: offer it here after a while.
  if (next.checkout.pending && !stepShown(step)) {
    if (S.unshownSince?.step !== step) {
      S.unshownSince = { step, at: Date.now() };
      setTimeout(update, UNSHOWN_STEP_MS + 100);
    }
  } else {
    S.unshownSince = null;
  }
  update();
}

/**
 * The payment this card showed went through on Menta (the user set up a
 * spending limit there, which paid it). Model context alone waits for the
 * user's next message, so the card says it once, as the user, and the
 * assistant takes a turn and follows the checkout.
 */
function tellIfPaidOnMenta(checkout: Checkout) {
  const shown = S.pin?.pending;
  if (
    shown?.kind !== "payment" ||
    !S.paymentSeenOpen ||
    S.paidAsked ||
    !isLeader() ||
    !paidPast(checkout, shown.requestId)
  ) {
    return;
  }
  S.paidAsked = true;
  void tellPaid(checkout, shown.requestId);
}

/**
 * Says it only once the server confirms a spending limit paid that request:
 * a decline, or the user's other words to the assistant, move a checkout on
 * too. The note goes to model context first, so the turn the message starts
 * knows the checkout's state and what to do next.
 */
async function tellPaid(checkout: Checkout, requestId: string) {
  let paid = false;
  try {
    paid = paidOf(
      await callTool("card_checkout", {
        runId: checkout.runId,
        paidFor: requestId,
      }),
    );
  } catch {
    // Unknown: say nothing; the model still gets the card's context.
  }
  // Only the leader tells the model; a newer card took over meanwhile.
  if (!paid || S.tornDown || !isLeader()) {
    return;
  }
  S.answerNote = `The user set up a spending limit on Menta and it paid the ${checkout.store} checkout.`;
  S.reported = "";
  // As after a step: a host that never answers holds the message back at
  // most 2 seconds.
  await Promise.race([
    report(),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (!(await tellHost(paidOnMentaMessage(checkout)))) {
    // tellHost's fallback replaced model context with the line alone.
    S.reported = "";
    report();
  }
}

/** Tell the model what the card saw, when it differs from what it last heard. */
function report() {
  const snapshot = S.snapshot;
  if (!snapshot || !isLeader()) {
    return;
  }
  const key = stateKey(snapshot.checkout);
  if (key === S.reported) {
    return;
  }
  S.reported = key;
  return updateModelContext(
    `${S.answerNote ? `${S.answerNote}\n\n` : ""}${refreshedContext(snapshot)}`,
  );
}

/** Tells the host's model; marked for the assistant so it isn't a composer chip. */
function updateModelContext(text: string) {
  return request("ui/update-model-context", {
    content: [assistantOnly(text)],
  }).catch(() => {
    // Hosts without model context updates still have the tool results.
  });
}

/** Calls one of our tools through the host (MCP Apps), or ChatGPT's own API. */
async function callTool(name: string, args: Record<string, unknown>) {
  if (S.viaOpenAi && typeof window.openai?.callTool === "function") {
    return window.openai.callTool(name, args);
  }
  return request("tools/call", { name, arguments: args }, 60_000);
}

/**
 * Says something as the user, so the host's model takes a turn: ui/message
 * where the host lists it, else ChatGPT's own API, else model context only.
 */
async function tellHost(text: string) {
  if (S.hostCanMessage) {
    try {
      const result = await request<{ isError?: boolean }>("ui/message", {
        role: "user",
        content: [{ type: "text", text }],
      });
      if (!result?.isError) {
        return true;
      }
    } catch {
      // Try ChatGPT's own API below.
    }
  }
  if (typeof window.openai?.sendFollowUpMessage === "function") {
    try {
      await window.openai.sendFollowUpMessage({ prompt: text });
      return true;
    } catch {
      // Fall back to model context.
    }
  }
  updateModelContext(text);
  return false;
}

// ---------------------------------------------------------------------------
// Polling. The newest card for a run reads it every few seconds while it is
// active; the others only when they haven't heard for a while. Being out of
// view slows it down instead of stopping it (some hosts report their frames
// as hidden).

function shouldPoll() {
  return Boolean(
    S.snapshot &&
      isActive(S.snapshot.checkout) &&
      S.canCallTools &&
      !S.tornDown &&
      !S.paused,
  );
}

function stopPolling() {
  clearTimeout(S.timer);
  S.timer = undefined;
}

function schedule(delay = POLL_MS) {
  stopPolling();
  if (!shouldPoll()) {
    return;
  }
  const following = !isLeader() && delay >= POLL_MS;
  const hidden = !S.visible || document.visibilityState !== "visible";
  const wait = following ? FOLLOWER_POLL_MS : delay;
  S.timer = setTimeout(
    poll,
    hidden && wait >= POLL_MS ? wait * HIDDEN_SLOWDOWN : wait,
  );
}

async function poll() {
  const snapshot = S.snapshot;
  if (!shouldPoll() || !snapshot) {
    return;
  }
  if (!isLeader() && Date.now() - S.lastRead < FOLLOWER_POLL_MS) {
    // The newest card is sharing its reads.
    schedule();
    return;
  }
  if (Date.now() - S.lastChange > IDLE_MS) {
    S.paused = true;
    update();
    return;
  }
  const runId = snapshot.checkout.runId;
  try {
    const next = parseResult(
      await callTool("card_checkout", { runId }),
      origin,
    );
    if (next) {
      S.lastRead = Date.now();
      S.failures = 0;
      S.error = null;
      if (
        S.pin?.pending?.kind === "payment" &&
        next.checkout.pending?.requestId === S.pin.pending.requestId
      ) {
        S.paymentSeenOpen = true;
      }
      readOwn(next);
      show(next);
      if (isLeader()) {
        say({ kind: "state", snapshot: next });
      }
      report();
    } else {
      S.failures++;
    }
  } catch {
    S.failures++;
  }
  if (S.failures >= 3 && !S.error) {
    S.error = (ui) => ui.m.card.cantRefresh;
    update();
  }
  schedule(S.failures > 0 ? POLL_MS * Math.min(S.failures + 1, 5) : POLL_MS);
}

/** "Check again" after the idle pause. */
function resume() {
  S.paused = false;
  S.lastChange = Date.now();
  update();
  schedule(0);
}

// ---------------------------------------------------------------------------
// What the user does in a card. Each sends through our tools, tells the
// model in a note it alone sees, and says it as the user so the model takes
// a turn, waits for the next step and shows it.

/** After the user answered, approved or entered details here. */
function afterStep(
  checkout: Checkout,
  requestId: string,
  drafts: Record<string, Draft>,
  said: string,
  note: string,
  message: string,
  result: unknown,
) {
  S.sent.set(requestId, drafts);
  // The card settles right away: the question and the answer, or a check.
  if (S.pin?.pending?.requestId === requestId) {
    S.pin = { ...S.pin, said };
    keepWidgetState({ said });
  }
  S.answerNote = note;
  // The model's next turn must already know to wait for the next step, so the
  // note lands before the message that starts that turn.
  // A host that never answers holds the message back at most 2 seconds.
  const noted = Promise.race([
    updateModelContext(note),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  const next = parseResult(result, origin);
  if (next) {
    S.reported = stateKey(next.checkout);
    readOwn(next);
    show(next);
    if (isLeader()) {
      say({ kind: "state", snapshot: next });
    }
  }
  S.lastChange = Date.now();
  S.paused = false;
  void noted.then(() => tellHost(message));
  schedule(POLL_MS);
  update();
  // Reading `checkout` keeps this obviously about one run.
  return checkout.runId;
}

async function answerHere(
  checkout: Checkout,
  pending: Extract<Pending, { kind: "question" }>,
  submission: Submission,
  drafts: Record<string, Draft>,
) {
  const ui = cardUi();
  // What the user sees they said, in their language; the model reads it in English.
  const shown =
    submission.kind === "instead"
      ? submission.text
      : submission.said
          .map((item) =>
            pending.fields.length > 1
              ? `${item.label}: ${item.value}`
              : item.value,
          )
          .join("; ");
  const said =
    submission.kind === "instead"
      ? submission.text
      : answerSummary(pending.fields, submission.answers);
  let result: unknown;
  try {
    result = await callTool("card_answer", {
      runId: checkout.runId,
      requestId: pending.requestId,
      ...(submission.kind === "instead"
        ? { instead: submission.text }
        : { answers: submission.answers }),
    });
  } catch {
    throw new Error(ui.m.card.couldntSend);
  }
  if (toolError(result)) {
    // Usually the store moved on; the next read shows where it is now.
    schedule(1500);
    throw new Error(ui.m.card.answerFailed);
  }
  afterStep(
    checkout,
    pending.requestId,
    drafts,
    shown,
    answeredContext(
      checkout,
      pending.question,
      submission.kind === "instead" ? `something else: ${said}` : said,
      pending.requestId,
    ),
    stepDoneMessage(checkout, { kind: "answer", said }),
    result,
  );
}

async function openLink(url: string) {
  const checkout = S.snapshot?.checkout;
  // A payment's link is the spending limit request page.
  const safe = checkout
    ? safeActionUrl(
        url,
        origin,
        checkout.runId,
        checkout.pending?.kind === "payment",
      )
    : null;
  if (!safe) {
    return;
  }
  try {
    await request("ui/open-link", { url: safe });
    return;
  } catch {
    // Fall through to the host's own API or a plain new tab.
  }
  try {
    if (typeof window.openai?.openExternal === "function") {
      window.openai.openExternal({ href: safe });
      return;
    }
  } catch {
    // Ignore and try a plain new tab.
  }
  window.open(safe, "_blank", "noopener,noreferrer");
}

// ---------------------------------------------------------------------------
// The secure step's script (Crossmint's components), loaded once, on demand.

let secureScript: Promise<OcaSecure> | null = null;
function loadSecureScript(): Promise<OcaSecure> {
  if (window.OcaSecure) {
    return Promise.resolve(window.OcaSecure);
  }
  secureScript ??= new Promise<OcaSecure>((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = `${origin}/mcp/card/secure.js?v=${__OCA_SECURE_VERSION__}`;
    tag.async = true;
    tag.onload = () =>
      window.OcaSecure
        ? resolve(window.OcaSecure)
        : reject(new Error("secure script missing"));
    tag.onerror = () => reject(new Error("secure script blocked"));
    document.head.append(tag);
  }).catch((error: unknown) => {
    secureScript = null;
    throw error;
  });
  return secureScript;
}

/** The host's CSP refusing one of Crossmint's frames, scripts or calls, for the open secure step. */
const cspListeners = new Set<(blocked: string) => void>();
document.addEventListener("securitypolicyviolation", (event) => {
  const blocked = String(event.blockedURI ?? "");
  if (
    blocked.startsWith(origin) ||
    /^https:\/\/([a-z0-9-]+\.)*(crossmint|basistheory)\.com/.test(blocked)
  ) {
    for (const listener of cspListeners) {
      listener(blocked);
    }
  }
});

type SecurePending = Extract<Pending, { kind: "protected" }>;

/**
 * The secure step for one request: credentials from the app-only
 * card_secure_session, Crossmint's script, then its components. Every failure
 * lands on the secure page link (`fallback`); "Try again here" retries.
 */
function useSecureStep(
  checkout: Checkout,
  pending: SecurePending,
  live: boolean,
) {
  const [state, setState] = useState<SecureState>(() =>
    live
      ? startSecureStep(pending, {
          secureStep: S.secureOffered,
          canCallTools: S.canCallTools,
          frozen: false,
        })
      : { phase: "link" },
  );
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState<{
    credentials: SecureCredentials;
    api: OcaSecure;
  } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const dispatch = (event: SecureEvent, note = "") => {
    setState((current) => secureStep(current, event));
    setMessage(note);
  };
  const loading = state.phase === "loading";
  const attempt = useRef(0);

  // Loading: credentials and the script, with a deadline.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per attempt at this request
  useEffect(() => {
    if (!loading) {
      return;
    }
    const mine = ++attempt.current;
    const current = () => attempt.current === mine;
    setReady(null);
    const timer = setTimeout(() => {
      if (current()) {
        dispatch({ type: "timeout" });
      }
    }, SECURE_LOAD_MS);
    // On a phone the inline card is short: give the secure step the screen.
    if (
      autoFullscreen({
        available: availableModes(),
        current: displayMode(),
        mobile: onMobile(S.context.platform, window.openai?.userAgent),
        alreadyFor: S.autoExpandedFor,
        requestId: pending.requestId,
      })
    ) {
      S.autoExpandedFor = pending.requestId;
      void setDisplayMode("fullscreen");
    }
    void (async () => {
      let credentials: ReturnType<typeof parseCredentials> = null;
      try {
        credentials = parseCredentials(
          await callTool("card_secure_session", {
            runId: checkout.runId,
            requestId: pending.requestId,
            origin: window.location.origin,
          }),
        );
      } catch {
        credentials = null;
      }
      if (!current()) {
        return;
      }
      if (!credentials) {
        dispatch({ type: "unavailable" });
        return;
      }
      try {
        const api = await loadSecureScript();
        if (current()) {
          setReady({ credentials, api });
        }
      } catch {
        if (current()) {
          dispatch({ type: "blocked" });
        }
      }
    })();
    return () => clearTimeout(timer);
  }, [loading, checkout.runId, pending.requestId]);

  // A CSP block while the step is up links out right away.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reads the state through its ref
  useEffect(() => {
    const listener = () => {
      const phase = stateRef.current.phase;
      if (phase === "loading" || phase === "ready") {
        dispatch({ type: "blocked" });
      }
    };
    cspListeners.add(listener);
    return () => {
      cspListeners.delete(listener);
    };
  }, []);

  const up =
    state.phase === "loading" ||
    state.phase === "ready" ||
    state.phase === "sending";
  return {
    state,
    message,
    dispatch,
    /** Script and credentials, while the step runs in the card. */
    ready: up ? ready : null,
    alive: () => {
      if (stateRef.current.phase === "loading") {
        dispatch({ type: "alive" });
      }
    },
    retry: () => dispatch({ type: "retry" }),
  };
}

/** Sends secure answers; the step's state follows the result. */
async function finishSecure(
  checkout: Checkout,
  pending: SecurePending,
  step: ReturnType<typeof useSecureStep>,
  call: () => Promise<unknown>,
) {
  let result: unknown;
  try {
    result = await call();
  } catch {
    result = { isError: true };
  }
  if (toolError(result)) {
    step.dispatch({ type: "submit-failed" });
    return;
  }
  step.dispatch({ type: "submitted" });
  afterStep(
    checkout,
    pending.requestId,
    {},
    "",
    secureDoneContext(checkout, pending),
    stepDoneMessage(checkout, { kind: "protected" }),
    result,
  );
}

// ---------------------------------------------------------------------------
// Display modes: Expand (fullscreen) for the secure step and a long run; Keep visible (pip) only where the host lists it (ChatGPT doesn't).

function displayMode(): DisplayMode {
  const mode = S.context.displayMode ?? window.openai?.displayMode;
  return mode === "fullscreen" || mode === "pip" ? mode : "inline";
}

function availableModes() {
  return hostModes(
    S.context.availableDisplayModes,
    typeof window.openai?.requestDisplayMode === "function",
    S.onChatGpt,
  );
}

/** Asks the host for a mode it lists; true when the card is in it afterwards. */
async function setDisplayMode(mode: DisplayMode) {
  if (!availableModes().includes(mode)) {
    return false;
  }
  try {
    if (S.context.availableDisplayModes?.includes(mode)) {
      const result = await request<{ mode?: McpUiDisplayMode }>(
        "ui/request-display-mode",
        { mode },
      );
      S.context = { ...S.context, displayMode: result?.mode ?? mode };
    } else if (typeof window.openai?.requestDisplayMode === "function") {
      const result = await window.openai.requestDisplayMode({ mode });
      const actual = result?.mode;
      S.context = {
        ...S.context,
        displayMode:
          actual === "inline" || actual === "pip" || actual === "fullscreen"
            ? actual
            : mode,
      };
    }
  } catch {
    // The host declined; stay as we are.
  }
  applyContext();
  update();
  return displayMode() === mode;
}

window.addEventListener("openai:set_globals", () => {
  applyContext();
  if (!S.canCallTools && S.bridgeKnown && detectTools()) {
    onToolsReady();
  }
  update();
});

// ---------------------------------------------------------------------------
// Theme, fonts and size.

const darkQuery =
  typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;
darkQuery?.addEventListener?.("change", () => {
  applyContext();
  update();
});

/** The host's theme, else ChatGPT's, else the system's. */
function hostTheme(): Theme {
  const theme = S.context.theme ?? window.openai?.theme;
  if (theme === "dark" || theme === "light") {
    return theme;
  }
  return darkQuery?.matches ? "dark" : "light";
}

function applyContext() {
  // Fullscreen and pip lay the card out for the space they give it, inside
  // the host's safe area (notches, the chat input over a phone's fullscreen).
  html.dataset.mode = displayMode();
  const insets = safeArea(S.context.safeAreaInsets);
  html.style.setProperty("--safe-top", insets.top);
  html.style.setProperty("--safe-right", insets.right);
  html.style.setProperty("--safe-bottom", insets.bottom);
  html.style.setProperty("--safe-left", insets.left);
  S.theme = hostTheme();
  html.dataset.theme = S.theme;
  applyHostColors();
}

/** The card's surface colors, resolved, for Crossmint's frames to sit on. */
function hostSurface() {
  const probe = document.createElement("span");
  document.body.append(probe);
  const read = (value: string) => {
    probe.style.color = value;
    return getComputedStyle(probe).color;
  };
  const surface = {
    background: read("var(--card)"),
    backgroundSecondary: read("var(--well)"),
    border: read("var(--hair)"),
  };
  probe.remove();
  return surface;
}

/**
 * The host's own chat colors under the card: its ground, card surface, insets
 * and hairlines, from its MCP Apps style variables when it sends them, else
 * the ones we read from ChatGPT and Claude. Type, buttons and accents stay Menta's.
 */
function applyHostColors() {
  const host = S.onChatGpt
    ? "chatgpt"
    : /claude/i.test(S.hostName)
      ? "claude"
      : "chatgpt";
  const preset = HOST_COLORS[host][S.theme];
  const given = (S.context.styles?.variables ?? {}) as Record<
    string,
    string | undefined
  >;
  const pick = (key: string, fallback: string) => {
    const value = given[key]?.trim();
    return value && /^[#a-z0-9(),.%\s/-]+$/i.test(value) ? value : fallback;
  };
  const ground = pick("--color-background-primary", preset.ground);
  html.style.setProperty("--ground", ground);
  html.style.setProperty(
    "--card",
    given["--color-background-primary"] ? ground : preset.card,
  );
  html.style.setProperty(
    "--well",
    pick("--color-background-secondary", preset.well),
  );
  html.style.setProperty("--hair", pick("--color-border-primary", preset.line));
}

/** Geist, from our origin (the card's CSP allows it as a resource domain). */
function loadFonts() {
  if (!/^https?:\/\//.test(origin)) {
    return;
  }
  const style = document.createElement("style");
  const face = (family: string, file: string) =>
    `@font-face{font-family:"${family}";src:url("${origin}/mcp/card/fonts/${file}") format("woff2");font-weight:100 900;font-style:normal;font-display:swap}`;
  style.textContent =
    face("Geist", __OCA_FONTS__.sans) + face("Geist Mono", __OCA_FONTS__.mono);
  document.head.append(style);
}

function watchSize() {
  let width = 0;
  let height = 0;
  let scheduled = false;
  const send = () => {
    if (scheduled) {
      return;
    }
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const previous = html.style.height;
      html.style.height = "max-content";
      const nextHeight = Math.ceil(html.getBoundingClientRect().height);
      html.style.height = previous;
      const nextWidth = Math.ceil(window.innerWidth);
      if (nextWidth !== width || nextHeight !== height) {
        width = nextWidth;
        height = nextHeight;
        notify("ui/notifications/size-changed", {
          width: nextWidth,
          height: nextHeight,
        });
        window.openai?.notifyIntrinsicHeight?.(nextHeight);
        checkFrameHeight(nextHeight);
      }
    });
  };
  send();
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(send);
    observer.observe(html);
    observer.observe(document.body);
  }
}

/**
 * After the card shrinks, whether the host shrank its frame too: if the frame
 * is still much taller a moment later, tell our server once (with both
 * heights and which resize call the host offers), so logs show which hosts
 * keep a frame at its tallest.
 */
let frameChecked = false;
let tallest = 0;
function checkFrameHeight(reported: number) {
  tallest = Math.max(tallest, reported);
  if (frameChecked || reported >= tallest - 40 || displayMode() !== "inline") {
    return;
  }
  frameChecked = true;
  window.setTimeout(() => {
    const frame = Math.round(window.innerHeight);
    if (frame - reported < 40) {
      return;
    }
    void callTool("card_diagnostics", {
      ...diagnosis("frame-kept-height"),
      reported,
      frame,
      openaiHeight: typeof window.openai?.notifyIntrinsicHeight === "function",
    }).catch(() => {});
  }, 1500);
}

function watchVisibility() {
  document.addEventListener("visibilitychange", () => schedule(500));
  if (typeof IntersectionObserver === "function") {
    new IntersectionObserver((entries) => {
      S.visible = entries.some((entry) => entry.isIntersecting);
      schedule(500);
    }).observe(mountPoint);
  }
}

// ---------------------------------------------------------------------------
// Views.

const primaryLink =
  "raised-ink inline-flex h-11 flex-none items-center justify-center gap-2 rounded-full bg-ink px-5 text-[14px] font-medium text-on-ink no-underline transition-colors hover:bg-ink-hover";
const quietLink =
  "text-[13px] text-muted underline decoration-line-strong underline-offset-[3px] hover:text-ink";

/**
 * The card is frozen on a stopped checkout: it keeps its look, but nothing in
 * it answers, sends or opens.
 */
const Frozen = createContext(false);

function SecureLink({ label, url }: { label: string; url: string }) {
  const frozen = useContext(Frozen);
  if (frozen) {
    return (
      <span aria-disabled="true" className={`${primaryLink} opacity-30`}>
        {label}
        <Arrow width={13} height={13} />
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={primaryLink}
      onClick={(event) => {
        event.preventDefault();
        void openLink(url);
      }}
    >
      {label}
      <Arrow width={13} height={13} />
    </a>
  );
}

/**
 * Store names our server read from their sites ("Pura Vida Miami" for
 * puravidamiami.com), asked once per site; the domain shows until then.
 */
const storeNames = new Map<string, string | null>();
function storeName(store: string) {
  const brand = storeBrand(store, origin);
  if (brand.icon.startsWith(`${origin}/stores/`)) {
    return brand.name;
  }
  const site = storeSite(store);
  if (!storeNames.has(site)) {
    storeNames.set(site, null);
    void fetch(`${origin}/mcp/card/store/${encodeURIComponent(site)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { name?: unknown } | null) => {
        if (typeof data?.name === "string" && data.name.trim()) {
          storeNames.set(site, data.name.trim().slice(0, 40));
          update();
        }
      })
      .catch(() => {});
  }
  return storeNames.get(site) ?? brand.name;
}

/** The store as an app icon: its own icon from our site, else its first letter. */
function StoreTile({ store, size = 44 }: { store: string; size?: number }) {
  const brand = storeBrand(store, origin);
  const [broken, setBroken] = useState(false);
  return (
    <span
      className="store-tile flex flex-none items-center justify-center bg-white"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
      }}
    >
      {brand.icon && !broken ? (
        <img
          src={brand.icon}
          alt=""
          width={Math.round(size * 0.55)}
          height={Math.round(size * 0.55)}
          className="block object-contain"
          onError={() => setBroken(true)}
        />
      ) : (
        <span
          className="font-semibold text-[#087f41]"
          style={{ fontSize: Math.round(size * 0.4) }}
        >
          {brand.letter}
        </span>
      )}
    </span>
  );
}

const chipStyle: Record<Tone, string> = {
  idle: "bg-(--well) text-soft",
  working: "bg-(--well) text-soft",
  attention: "bg-attention-soft text-attention-ink",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  muted: "bg-(--well) text-quiet",
};
const chipDot: Record<Tone, string> = {
  idle: "bg-faint",
  working: "pulse bg-[#10b45e]",
  attention: "bg-attention",
  success: "bg-success",
  danger: "bg-danger",
  muted: "bg-faint",
};

/** The checkout's state as a pill; a placed order gets the leaf's check. */
function Chip({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className={`inline-flex h-6 max-w-[48%] flex-none items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${chipStyle[tone]}`}
    >
      {tone === "success" ? (
        <span className="leaf-fill inline-flex size-3.5 flex-none items-center justify-center rounded-full text-white">
          <Check width={9} height={9} />
        </span>
      ) : (
        <span className={`size-1.5 flex-none rounded-full ${chipDot[tone]}`} />
      )}
      <span className="truncate">{label}</span>
    </span>
  );
}

/** The store stopped it ("Couldn't buy · <reason>"), as opposed to "Not confirmed". */
function couldntBuy(checkout: Checkout) {
  return checkout.status === "blocked" && !unconfirmed(checkout);
}

/** How a checkout ended, as a chip: short, the reason (if any) is in the body. */
function chipFor(checkout: Checkout, ui: Ui): { tone: Tone; label: string } {
  const ended = describe(checkout, ui);
  return {
    tone: ended.tone,
    label: couldntBuy(checkout) ? ui.m.status.couldntBuy : ended.label,
  };
}

/** The card's head: the store's icon and name, the task, the state. */
function Head({
  checkout,
  chip,
}: {
  checkout: Checkout;
  chip: { tone: Tone; label: string };
}) {
  const name = storeName(checkout.store);
  return (
    <div className="flex items-center gap-3">
      <StoreTile store={checkout.store} />
      <span className="flex min-w-0 flex-1 flex-col leading-snug">
        <span className="truncate text-[14px] font-medium text-ink">
          {name}
        </span>
        <span className="truncate text-[12.5px] text-muted">
          {checkout.task ? shortTask(checkout.task) : checkout.store}
        </span>
      </span>
      <Chip tone={chip.tone} label={chip.label} />
    </div>
  );
}

/** How it ended: the receipt for a placed order, else why, in a sentence. */
function Outcome({ checkout }: { checkout: Checkout }) {
  const ui = useUi();
  const line = outcomeLine(checkout, ui);
  const reason = couldntBuy(checkout)
    ? blockedReason(checkout.result?.blockedCode, ui)
    : null;
  const receipt =
    checkout.status === "succeeded" ? checkout.result?.receipt : null;
  if (receipt) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3 border-t border-dashed border-(--hair-strong) pt-3.5">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[11px] font-medium text-muted">
              {ui.m.outcome.total}
            </span>
            {receipt.merchantOrderId ? (
              <span className="truncate font-mono text-[11.5px] text-soft">
                {ui.f(ui.m.outcome.order, { id: receipt.merchantOrderId })}
              </span>
            ) : null}
          </span>
          <span className="text-[28px] leading-none font-light tracking-[-0.03em] text-ink tabular-nums">
            {money(receipt.total, ui)}
          </span>
        </div>
        {checkout.shipsTo ? (
          <span className="border-t border-dashed border-(--hair-strong) pt-3 text-center text-[11.5px] text-muted">
            {ui.f(ui.m.outcome.deliveringTo, checkout.shipsTo)}
          </span>
        ) : null}
      </div>
    );
  }
  const text = sentences(ui, [reason, line]);
  return text ? (
    <p className="m-0 text-[13px] leading-snug text-pretty text-soft">{text}</p>
  ) : null;
}

function QuestionStep({
  checkout,
  pending,
}: {
  checkout: Checkout;
  pending: Extract<Pending, { kind: "question" }>;
}) {
  return (
    <RequestForm
      requestId={pending.requestId}
      question={pending.question}
      expiresAt={null}
      entries={pending.fields.map((field) => ({ kind: "standard", field }))}
      sent={S.sent.get(pending.requestId)}
      pick
      canSend={S.canCallTools}
      disabled={useContext(Frozen)}
      scrollClassName={
        displayMode() === "inline"
          ? ""
          : "max-h-[min(62dvh,560px)] overflow-y-auto overscroll-contain"
      }
      onSubmit={(submission, drafts) =>
        answerHere(checkout, pending, submission, drafts)
      }
    />
  );
}

/**
 * A payment no spending limit covers: a link to Menta's
 * spending limit request page, where the user sets one up on their card (with
 * the card's verification). Approving there pays this checkout and leads back
 * here; the card's poll sees it.
 */
function PaymentStepView({
  pending,
}: {
  pending: Extract<Pending, { kind: "payment" }>;
}) {
  const { m } = useUi();
  // What a spending limit is, in the spending limit request page's words.
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[13.5px] leading-snug text-pretty text-soft">
        {m.payment.lede}
      </p>
      <SecureLink label={m.payment.setUpLimit} url={pending.actionUrl} />
      <span className="flex justify-center">
        <PoweredByCrossmint />
      </span>
    </div>
  );
}

/**
 * Above private fields: what the store asks for (sign in, a new password, a
 * code it sent, other details), by Crossmint's input hints.
 */
function SecretTitle({
  checkout,
  pending,
}: {
  checkout: Checkout;
  pending: Extract<Pending, { kind: "protected" }>;
}) {
  const ui = useUi();
  const { title, line } = secretTitle(
    pending.ask,
    storeName(checkout.store),
    pending.question,
    ui,
  );
  return (
    <div className="flex flex-col gap-1">
      <p className="m-0 text-[14px] font-medium text-ink">{title}</p>
      {line ? (
        <p className="m-0 text-[13.5px] leading-snug text-pretty text-soft">
          {line}
        </p>
      ) : null}
    </div>
  );
}

function ProtectedStep({
  checkout,
  pending,
}: {
  checkout: Checkout;
  pending: Extract<Pending, { kind: "protected" }>;
}) {
  const { m } = useUi();
  const frozen = useContext(Frozen);
  const step = useSecureStep(checkout, pending, !frozen);
  const slots = useRef(new Map<string, HTMLElement>());
  const mount = useRef<ProtectedMount | null>(null);
  const ready = step.ready;
  const theme = S.theme;
  const phase = step.state.phase;
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount once per script load and theme
  useEffect(() => {
    if (!ready) {
      return;
    }
    const placed = pending.fields.flatMap((item) => {
      if (item.handling !== "protected") {
        return [];
      }
      const element = slots.current.get(item.descriptor.key);
      return element ? [{ element, descriptor: item.descriptor }] : [];
    });
    try {
      mount.current = ready.api.mountProtected({
        credentials: ready.credentials,
        slots: placed,
        theme,
        locale: cardUi().locale,
        surface: hostSurface(),
        onAlive: step.alive,
        onError: () => step.dispatch({ type: "error" }),
      });
    } catch {
      step.dispatch({ type: "error" });
    }
    return () => {
      try {
        mount.current?.unmount();
      } catch {
        // Already gone.
      }
      mount.current = null;
    };
  }, [ready, theme]);
  useEffect(() => {
    mount.current?.setDisabled(phase !== "ready" || frozen);
  }, [phase, frozen]);

  if (phase === "link" || phase === "fallback") {
    return (
      <div className="flex flex-col gap-3">
        {/* What the store asks for, then where it goes: where the card can't draw Crossmint's input, Menta is simply the place, one step, no failure note. */}
        <SecretTitle checkout={checkout} pending={pending} />
        <SecureLink label={m.secure.fillOnMenta} url={pending.actionUrl} />
        <span className="flex items-start gap-2 text-xs text-muted">
          <Shield width={13} height={13} className="mt-px flex-none" />
          <span className="text-pretty">{m.secure.fillOnMentaNote}</span>
        </span>
        <span className="mt-1 flex justify-center">
          <PoweredByCrossmint />
        </span>
      </div>
    );
  }
  const entries: FormEntry[] = pending.fields.map((item) =>
    item.handling === "protected"
      ? {
          kind: "protected",
          field: {
            key: item.descriptor.key,
            label: item.descriptor.label,
            required: item.descriptor.required,
          },
        }
      : { kind: "standard", field: item.field },
  );
  const sent =
    S.sent.get(pending.requestId) ?? (phase === "sent" ? {} : undefined);
  // What the store asks for, the fields, then "Powered by Crossmint", like
  // the payment step.
  return (
    <div className="flex flex-col gap-4">
      <SecretTitle checkout={checkout} pending={pending} />
      <RequestForm
        requestId={pending.requestId}
        question=""
        expiresAt={null}
        entries={entries}
        sent={sent}
        disabled={phase !== "ready" || frozen}
        secretNote={m.form.secretNoteAssistant}
        scrollClassName=""
        renderProtected={(field) => (
          <Settled label={m.secure.loading}>
            <div
              className="min-h-10"
              ref={(element) => {
                if (element) {
                  slots.current.set(field.key, element);
                }
              }}
            />
          </Settled>
        )}
        onSubmit={async (submission, drafts) => {
          if (submission.kind !== "answers") {
            return;
          }
          step.dispatch({ type: "submit" });
          const collected = mount.current
            ? await mount.current.collect()
            : { ok: false as const, message: m.secure.notReady };
          if (!collected.ok) {
            step.dispatch({ type: "invalid" });
            throw new Error(collected.message);
          }
          await finishSecure(checkout, pending, step, () =>
            callTool("card_submit_secure_answers", {
              runId: checkout.runId,
              requestId: pending.requestId,
              answers: { ...submission.answers, ...collected.values },
            }),
          );
          S.sent.set(pending.requestId, drafts);
        }}
      />
      {step.message ? (
        <span className="text-xs text-danger">{step.message}</span>
      ) : null}
      <span className="flex justify-center">
        <PoweredByCrossmint />
      </span>
    </div>
  );
}

/** What the store is waiting on, as the dock's body shows it. */
function StepBody({ checkout }: { checkout: Checkout }) {
  const pending = checkout.pending;
  if (pending?.kind === "question") {
    return (
      <QuestionStep
        key={pending.requestId}
        checkout={checkout}
        pending={pending}
      />
    );
  }
  if (pending?.kind === "payment") {
    return (
      <PaymentStepView
        key={`${pending.requestId}-${S.canCallTools}`}
        pending={pending}
      />
    );
  }
  if (pending?.kind === "protected") {
    return (
      <ProtectedStep
        key={`${pending.requestId}-${S.canCallTools}`}
        checkout={checkout}
        pending={pending}
      />
    );
  }
  return null;
}

/** Paused updates, errors and the display-mode buttons. */
function Footer({ checkout, live }: { checkout: Checkout; live: boolean }) {
  const ui = useUi();
  const { m } = ui;
  const offers = modeOffers({
    available: availableModes(),
    current: displayMode(),
    active: isActive(checkout),
    frozen: !live,
  });
  const modeButton = (label: string, mode: DisplayMode) => (
    <button
      type="button"
      className={quietLink}
      onClick={() => {
        void setDisplayMode(mode);
      }}
    >
      {label}
    </button>
  );
  const paused = live && S.paused && isActive(checkout);
  if (!paused && !S.error && !offers.back) {
    return null;
  }
  return (
    <div className="flex min-h-8 items-center gap-3">
      <span className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted">
        {paused ? (
          <>
            {m.card.pausedUpdates}
            <button type="button" className={quietLink} onClick={resume}>
              {m.card.checkAgain}
            </button>
          </>
        ) : null}
        {S.error ? (
          <span role="alert" className="text-danger">
            {S.error(ui)}
          </span>
        ) : null}
      </span>
      {offers.back
        ? modeButton(
            displayMode() === "pip" ? m.card.backInChat : m.card.backToChat,
            "inline",
          )
        : null}
    </div>
  );
}

/**
 * A live card: what the store is waiting on, or how it ended (the receipt
 * names the store).
 */
function LiveCard({
  snapshot,
  frozen = false,
}: {
  snapshot: Snapshot;
  frozen?: boolean;
}) {
  const checkout = snapshot.checkout;
  const ui = useUi();
  return (
    <Frozen.Provider value={frozen}>
      <div className="card-panel flex flex-col gap-4 p-4">
        {/* The chat already says where; only a receipt names the store. */}
        {checkout.status === "succeeded" ? (
          <Head checkout={checkout} chip={chipFor(checkout, ui)} />
        ) : null}
        {isActive(checkout) ? (
          <StepBody checkout={checkout} />
        ) : (
          <Outcome checkout={checkout} />
        )}
        <Footer checkout={checkout} live={!frozen} />
      </div>
    </Frozen.Provider>
  );
}

/** "Show it here": the newest card offers a step the store opened that no card shows. */
function ShowItHere({ checkout }: { checkout: Checkout }) {
  const ui = useUi();
  const frozen = useContext(Frozen);
  return (
    <button
      type="button"
      className={quietLink}
      disabled={frozen}
      onClick={() => {
        if (frozen) {
          return;
        }
        S.expandedFor = stepKey(checkout);
        update();
      }}
    >
      {ui.m.settled.showItHere}
    </button>
  );
}

/** A check in the leaf's green: this step passed. */
function PassedMark() {
  return (
    <span className="leaf-fill inline-flex size-[18px] flex-none items-center justify-center rounded-full text-white">
      <Check width={10} height={10} />
    </span>
  );
}

/**
 * A store question or private details once the step passed, without the
 * store: the question and what the user answered, or that the details went
 * securely.
 */
function PassedCard({
  passed,
  unshown,
  checkout,
}: {
  passed: NonNullable<ReturnType<typeof passedStep>>;
  unshown: boolean;
  checkout: Checkout;
}) {
  const ui = useUi();
  const t = ui.m.settled;
  if (passed.kind === "protected") {
    return (
      <div className="card-panel flex min-h-11 items-center gap-2.5 px-3 py-2 text-[13.5px]">
        <PassedMark />
        <span className="min-w-0 flex-1 truncate font-medium text-ink">
          {t.sentSecurely}
        </span>
        {unshown ? <ShowItHere checkout={checkout} /> : null}
      </div>
    );
  }
  return (
    <div className="card-panel flex flex-col gap-1.5 px-3 py-2.5">
      <span className="flex items-center gap-2 text-xs font-medium text-muted">
        <PassedMark />
        <span className="min-w-0 flex-1">{t.answered}</span>
        {unshown ? <ShowItHere checkout={checkout} /> : null}
      </span>
      {passed.question ? (
        <p className="m-0 line-clamp-2 text-[13px] leading-snug text-pretty text-muted">
          {passed.question}
        </p>
      ) : null}
      {passed.said ? (
        <p className="m-0 line-clamp-3 text-[14px] leading-snug font-medium text-pretty text-ink">
          {passed.said}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A card whose step has passed, in one slim row: what happened, with the
 * store's icon and name for a payment or a card drawn while it worked.
 */
function SettledCard({
  snapshot,
  tone,
  text,
  progress,
  unshown,
  leader,
  store,
}: {
  snapshot: Snapshot;
  tone: Tone;
  text: string;
  /** The newest card for the run: it alone repeats the receipt. */
  leader: boolean;
  progress: { text: string; running: boolean } | null;
  unshown: boolean;
  /** Names the store; a store question or private details card doesn't. */
  store: boolean;
}) {
  const ui = useUi();
  const checkout = snapshot.checkout;
  const receipt =
    leader && !isActive(checkout) ? checkout.result?.receipt : null;
  const line = `${text}${receipt ? ` · ${money(receipt.total, ui)}` : ""}`;
  return (
    <div
      className={`card-panel flex min-h-11 items-center gap-2.5 py-1.5 text-[13.5px] ${store ? "px-2" : "px-3"}`}
    >
      {store ? <StoreTile store={checkout.store} size={28} /> : null}
      <span className="flex min-w-0 flex-1 flex-col leading-snug">
        {store ? (
          <span className="flex min-w-0 items-baseline">
            <span className="flex-none font-medium text-ink">
              {storeName(checkout.store)}
            </span>
            <span className="min-w-0 truncate whitespace-pre text-muted">
              {" · "}
              {line}
            </span>
          </span>
        ) : (
          <span className="min-w-0 truncate text-muted">{line}</span>
        )}
        {progress ? (
          <span title={progress.text} className="truncate text-xs text-muted">
            <span className={progress.running ? "shimmer" : ""}>
              {progress.text}
            </span>
          </span>
        ) : null}
      </span>
      {unshown ? (
        <ShowItHere checkout={checkout} />
      ) : tone === "success" ? (
        <Chip tone="success" label={ui.m.status.done} />
      ) : null}
    </div>
  );
}

function StepCard({ snapshot: latest }: { snapshot: Snapshot }) {
  const ui = useUi();
  const pin = S.pin;
  if (!pin) {
    return null;
  }
  // A step card keeps showing what it showed when the checkout stops, if
  // this card saw it active; the assistant reports the stop in text. Frozen
  // there, nothing in it answers, sends or opens.
  const kept = keepsLastState(pin, latest.checkout, S.seenActive)
    ? S.lastActive
    : null;
  const frozen = kept !== null;
  const snapshot = kept ?? latest;
  const checkout = snapshot.checkout;
  const peers = peerFacts();
  const leader = isLeader();
  const step = stepKey(checkout);
  // A card drawn when the checkout had already ended (continue's last result)
  // shows how it ended in full while it's the newest card.
  // Once the user acted here the card settles at once, without waiting for
  // the store.
  const live =
    (pin.said === null && isCurrent(pin, checkout, peers)) ||
    (pin.step === "end" && step === "end" && leader) ||
    (S.expandedFor === step && step !== pin.step && leader);
  if (live) {
    return <LiveCard snapshot={snapshot} frozen={frozen} />;
  }
  const unshown =
    leader &&
    Boolean(latest.checkout.pending) &&
    S.unshownSince?.step === stepKey(latest.checkout) &&
    Date.now() - S.unshownSince.at >= UNSHOWN_STEP_MS;
  const duplicate = peers.earlierSameStep && pin.step === step;
  const passed = passedStep(pin, checkout, { moved: S.moved, duplicate });
  if (passed) {
    return (
      <Frozen.Provider value={frozen}>
        <PassedCard passed={passed} unshown={unshown} checkout={checkout} />
      </Frozen.Provider>
    );
  }
  const settled = settledLine(
    pin,
    checkout,
    { moved: S.moved, duplicate, leader },
    ui,
  );
  const working =
    leader &&
    isActive(latest.checkout) &&
    !latest.checkout.pending &&
    S.canCallTools
      ? progressLine(latest.progress, Date.now(), false, ui)
      : null;
  return (
    <Frozen.Provider value={frozen}>
      <SettledCard
        snapshot={snapshot}
        tone={settled.tone}
        text={settled.text}
        progress={working}
        unshown={unshown}
        leader={leader}
        store={
          pin.pending?.kind !== "question" && pin.pending?.kind !== "protected"
        }
      />
    </Frozen.Provider>
  );
}

function App() {
  const ui = useUi();
  const snapshot = S.snapshot;
  let body: ReturnType<typeof StepCard>;
  if (!snapshot) {
    body = (
      <div className="card-panel flex flex-col gap-1 p-4">
        <span className="text-[14px] font-medium text-ink">
          {S.problem ? ui.m.card.noCheckout : "Menta"}
        </span>
        <p className="m-0 text-[13px] text-muted">
          {S.problem
            ? S.problem(ui)
            : S.initialized
              ? ui.m.card.waiting
              : ui.m.card.connecting}
        </p>
      </div>
    );
  } else {
    body = <StepCard snapshot={snapshot} />;
  }
  return <div className="@container flex flex-col px-1 py-1">{body}</div>;
}

// ---------------------------------------------------------------------------
// Start.

async function start() {
  loadFonts();
  applyContext();
  update();
  watchSize();
  watchVisibility();
  try {
    const result = await request<McpUiInitializeResult>(
      "ui/initialize",
      {
        appInfo: { name: "oca-checkout", version: "2.0.0" },
        // Every mode the card supports; it asks only for those the host lists.
        appCapabilities: {
          availableDisplayModes: ["inline", "fullscreen", "pip"],
        },
        protocolVersion: PROTOCOL_VERSION,
      },
      20_000,
    );
    S.context = result?.hostContext ?? {};
    S.canCallTools = Boolean(result?.hostCapabilities?.serverTools);
    S.advertisedTools = S.canCallTools;
    S.hostCanMessage = Boolean(result?.hostCapabilities?.message);
    S.hostName = String(result?.hostInfo?.name ?? "").slice(0, 60);
    S.onChatGpt ||= /chatgpt|openai/i.test(S.hostName);
    S.initialized = true;
    applyContext();
    notify("ui/notifications/initialized");
    bridgeUp(S.canCallTools ? null : "no-server-tools");
  } catch {
    // The host never answered (or refused). ChatGPT's own API may still work.
    if (!S.snapshot) {
      S.problem = (ui) => ui.m.card.onlyInHosts;
    }
    bridgeUp("initialize-failed");
  }
}

// ---------------------------------------------------------------------------
// Tool calls the host may bring up late or never advertise. A card that
// can't call our tools says so (and links to live progress on our page)
// instead of promising updates, keeps checking for a while, and tells our
// server once why it can't follow the checkout, so logs show which case it is.

function bridgeUp(reason: DiagnosticReason | null) {
  S.bridgeKnown = true;
  detectTools();
  if (S.canCallTools) {
    onToolsReady();
  } else if (reason) {
    // After the tool result has arrived, so the log names the checkout.
    setTimeout(() => void probeTools(reason), 1000);
  }
  update();
  // The bridge can come up late: look again for a while.
  for (const delay of [1500, 5000, 15_000]) {
    setTimeout(() => {
      if (!S.canCallTools && detectTools()) {
        onToolsReady();
      }
    }, delay);
  }
}

/** ChatGPT's own callTool, when the host didn't offer tools/call. */
function detectTools() {
  if (!S.canCallTools && typeof window.openai?.callTool === "function") {
    S.canCallTools = true;
    S.viaOpenAi = true;
  }
  return S.canCallTools;
}

function onToolsReady() {
  update();
  schedule();
}

/**
 * Tries one tools/call anyway: some hosts answer it without listing
 * serverTools. Either way the server logs why (card_diagnostics); if it went
 * through, the card follows the checkout after all.
 */
async function probeTools(reason: DiagnosticReason) {
  try {
    const result = await request<{ isError?: boolean }>(
      "tools/call",
      { name: "card_diagnostics", arguments: diagnosis(reason) },
      8000,
    );
    if (result && !S.canCallTools) {
      S.canCallTools = true;
      S.diagnosed.add(reason);
      diagnose("tools-unadvertised");
      onToolsReady();
    }
  } catch {
    // Nothing reaches our server from here; the card shows the link.
  }
}

function diagnosis(reason: DiagnosticReason) {
  return {
    reason,
    host: S.hostName,
    serverTools: S.advertisedTools,
    openaiCallTool: typeof window.openai?.callTool === "function",
    ...(S.snapshot ? { runId: S.snapshot.checkout.runId } : {}),
  };
}

/** Tells our server once why the card can't follow the checkout. */
function diagnose(reason: DiagnosticReason) {
  if (S.diagnosed.has(reason) || !S.canCallTools) {
    return;
  }
  S.diagnosed.add(reason);
  void callTool("card_diagnostics", diagnosis(reason)).catch(() => {});
}

// A watchdog for a card that should be polling and isn't.
setInterval(() => {
  const snapshot = S.snapshot;
  if (!snapshot || S.tornDown || !isLeader()) {
    return;
  }
  const reason = stallReason({
    active: isActive(snapshot.checkout),
    sinceRead: Date.now() - S.lastRead,
    frozen: false,
    paused: S.paused,
    hidden: !S.visible || document.visibilityState !== "visible",
  });
  if (reason) {
    diagnose(reason);
    if (!S.paused && S.canCallTools) {
      // Nothing should stop it: try again now.
      schedule(0);
    }
  }
}, 10_000);

// Progress lines age ("Still working…"): look again now and then.
setInterval(() => {
  if (S.snapshot && isActive(S.snapshot.checkout)) {
    update();
  }
}, 15_000);

void start();
