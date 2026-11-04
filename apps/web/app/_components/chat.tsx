"use client";

import { locationAnswer } from "@oca/agent/location";
import type { CheckoutView } from "@oca/crossmint-agent-checkouts/checkouts";
import {
  type EveMessage,
  openConversationInputs,
  useEveAgent,
} from "eve/react";
import Image from "next/image";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAccount } from "../../lib/client/account";
import {
  byUrgency,
  type CheckoutRef,
  dockNoteLine,
  isActive,
  readDockNote,
  useCheckouts,
} from "../../lib/client/checkouts";
import { useDictation } from "../../lib/client/dictation";
import { useI18n } from "../../lib/i18n/client";
import "../../lib/client/eve-dev-retry";
import { type CheckoutPage, runsNeedingYou } from "@oca/client/checkouts";
import {
  activity,
  canceledRuns,
  checkoutMentions,
  following,
  placeOutcomes,
  runOf,
  type ToolPart,
  textOf,
  withoutConfirmedEchoes,
} from "@oca/client/conversation";
import { randomThinkingPhrase } from "@oca/client/thinking";
import { groupSteps, stepTools } from "@oca/client/tool-steps";
import {
  LOCATION_TOOL,
  type Located,
  locate,
  readLocationStep,
  rememberedPlace,
} from "../../lib/client/location";
import {
  imageFiles,
  MAX_PHOTOS,
  PHOTO_TYPES,
  type Photo,
  photoKey,
  photoMessage,
  photosOf,
  preparePhoto,
  withoutFileLines,
} from "../../lib/client/photos";
import { usePrediction } from "../../lib/client/predictions";
import { BackHeader } from "../(app)/page-shell";
import { AddressNudge } from "./address-nudge";
import { CheckoutCard, CheckoutRow } from "./checkout-card";
import { CheckoutDock } from "./checkout-dock";
import { DictationControls } from "./dictation";
import { ArrowUp, Camera, Check, Chevron, Close, Stop } from "./icons";
import { LiveView } from "./live-view";
import { PhotoViewer, type Viewing } from "./photo-viewer";
import { ChatHistory } from "./sidebar";
import { LocationStep, ToolSteps } from "./tool-steps";

function Working({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-muted" role="status">
      <span className="spinner" />
      {children}
    </div>
  );
}

function ConversationSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading conversation"
      className="flex animate-pulse flex-col gap-7"
    >
      <span className="h-11 w-2/5 self-end rounded-[20px_20px_6px_20px] bg-chip" />
      <div className="flex flex-col gap-2">
        <span className="h-3.5 w-11/12 rounded-full bg-chip" />
        <span className="h-3.5 w-3/4 rounded-full bg-chip" />
      </div>
      <span className="h-9 w-72 max-w-full rounded-full bg-chip" />
    </div>
  );
}

const noSubscription = () => () => {};

/**
 * What the user did in the checkout panel, as one quiet line on their side:
 * the message itself spells it out for the agent.
 */
function DockNoteLine({ text }: { text: string }) {
  const note = readDockNote(text);
  if (!note) {
    return null;
  }
  const { what, detail } = dockNoteLine(note);
  return (
    <p
      title={text}
      className="flex max-w-[82%] min-w-0 items-center gap-1.5 text-[13px] text-muted"
    >
      <Check width={13} height={13} className="flex-none" />
      <span className="min-w-0 truncate text-soft">{what}</span>
      {detail ? (
        <span className="min-w-0 shrink-[4] truncate">· {detail}</span>
      ) : null}
    </p>
  );
}

/** The photos waiting in the composer, each with a button to take it out. */
function PhotoStrip({
  photos,
  preparing,
  onRemove,
  onView,
}: {
  photos: readonly Photo[];
  preparing: number;
  onRemove: (id: string) => void;
  onView: (index: number) => void;
}) {
  return (
    <ul aria-label="Photos to send" className="flex flex-wrap gap-2">
      {photos.map((photo, index) => (
        <li key={photo.id} className="relative">
          <button
            type="button"
            onClick={() => onView(index)}
            aria-label="View photo"
            className="block cursor-zoom-in"
          >
            {/* biome-ignore lint/performance/noImgElement: a local data: URL */}
            <img
              src={photo.url}
              alt=""
              className="size-16 rounded-[12px] object-cover ring-1 ring-black/[0.06]"
            />
          </button>
          <button
            type="button"
            onClick={() => onRemove(photo.id)}
            aria-label="Remove photo"
            className="tap absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full bg-ink text-white [&_svg]:size-3"
          >
            <Close />
          </button>
        </li>
      ))}
      {Array.from({ length: preparing }, (_, index) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: interchangeable placeholders
          key={index}
          className="well flex size-16 items-center justify-center rounded-[12px]"
        >
          <span className="spinner" />
        </li>
      ))}
    </ul>
  );
}

function Composer({
  value,
  onChange,
  photos,
  onPhotosChange,
  onSubmit,
  onStop,
  busy,
  disabled,
  hero,
  placeholder,
  prediction,
}: {
  value: string;
  onChange: (value: string) => void;
  photos: readonly Photo[];
  onPhotosChange: (update: (photos: readonly Photo[]) => Photo[]) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
  disabled: boolean;
  hero?: boolean;
  placeholder: string;
  prediction: { text: string; dismiss: () => void };
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const predictionDescription = useId();
  const dictation = useDictation({ value, onChange, input: ref });
  const [preparing, setPreparing] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Viewing | null>(null);
  const predicted =
    value.length === 0 &&
    !disabled &&
    !dictation.active &&
    photos.length === 0 &&
    preparing === 0
      ? prediction.text
      : "";
  function acceptPrediction() {
    if (!predicted) {
      return;
    }
    onChange(predicted);
    ref.current?.focus();
  }
  // Re-measure wrapping and rebind when the hero textarea is replaced.
  // biome-ignore lint/correctness/useExhaustiveDependencies: strings affect wrapping; hero replaces the observed textarea.
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const measure = () => {
      element.style.height = "auto";
      element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
    };
    measure();
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== width) {
        width = element.clientWidth;
        measure();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [value, predicted, hero]);
  useEffect(() => {
    if (!photoError) {
      return;
    }
    const timer = setTimeout(() => setPhotoError(null), 6000);
    return () => clearTimeout(timer);
  }, [photoError]);
  // The page can know more than the server render did by the time React
  // hydrates (a draft the browser restored, a reply already streaming), so the
  // button starts as the server drew it and catches up right after.
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const hasContent = Boolean(value.trim()) || photos.length > 0;
  const stop = hydrated && busy && !hasContent && preparing === 0;

  // Big camera photos are shrunk in the browser before they are sent.
  // Keys of photos still being prepared, so a quick second add of the same
  // photo is caught before the first one lands.
  const pending = useRef(new Set<string>());
  async function addPhotos(files: File[]) {
    if (files.length === 0) {
      return;
    }
    const keys = await Promise.all(files.map(photoKey));
    const seen = new Set([
      ...photos.map((photo) => photo.id),
      ...pending.current,
    ]);
    const fresh = files.flatMap((file, index) => {
      const key = keys[index] as string;
      if (seen.has(key)) {
        return [];
      }
      seen.add(key);
      return [{ file, key }];
    });
    const room = MAX_PHOTOS - photos.length - pending.current.size;
    if (fresh.length > room) {
      setPhotoError(`You can send up to ${MAX_PHOTOS} photos at a time.`);
    } else if (fresh.length < files.length) {
      setPhotoError(
        files.length === 1
          ? "That photo is already added."
          : "Skipped photos that are already added.",
      );
    }
    const taken = fresh.slice(0, Math.max(0, room));
    if (taken.length === 0) {
      return;
    }
    for (const { key } of taken) {
      pending.current.add(key);
    }
    setPreparing((count) => count + taken.length);
    await Promise.all(
      taken.map(async ({ file, key }) => {
        try {
          const photo = await preparePhoto(file, key);
          onPhotosChange((current) =>
            current.length < MAX_PHOTOS &&
            !current.some((added) => added.id === key)
              ? [...current, photo]
              : [...current],
          );
        } catch (error) {
          setPhotoError(
            error instanceof Error ? error.message : "Couldn't add that photo.",
          );
        } finally {
          pending.current.delete(key);
          setPreparing((count) => count - 1);
        }
      }),
    );
    ref.current?.focus();
  }

  const photoButton = (
    <>
      <input
        ref={picker}
        type="file"
        accept={PHOTO_TYPES}
        multiple
        hidden
        onChange={(event) => {
          void addPhotos(imageFiles(event.target.files));
          event.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => picker.current?.click()}
        disabled={disabled || dictation.active}
        aria-label="Add photos"
        title="Take or add photos"
        className={`tap relative inline-flex size-10 flex-none items-center justify-center rounded-full text-soft transition-colors hover:bg-black/[0.04] hover:text-ink disabled:opacity-30 ${hero ? "" : "row-start-2 sm:row-start-1"}`}
      >
        <Camera />
      </button>
    </>
  );
  const controls = (
    <DictationControls
      status={dictation.status}
      elapsed={dictation.elapsed}
      level={dictation.level}
      error={dictation.error}
      onDismissError={dictation.dismissError}
      onStart={() => void dictation.start()}
      onStop={dictation.stop}
      onCancel={dictation.cancel}
      disabled={disabled}
    >
      <button
        type={stop ? "button" : "submit"}
        onClick={stop ? onStop : undefined}
        aria-label={stop ? "Stop" : "Send"}
        disabled={
          !hydrated || disabled || (!stop && (!hasContent || preparing > 0))
        }
        className="raised inline-flex size-10 flex-none items-center justify-center rounded-full bg-ink text-white hover:bg-ink-hover disabled:opacity-30"
      >
        {stop ? <Stop /> : <ArrowUp />}
      </button>
    </DictationControls>
  );
  const textarea = (
    <textarea
      id="message"
      ref={ref}
      rows={hero ? 2 : 1}
      autoFocus
      value={value}
      readOnly={dictation.active}
      placeholder={dictation.active ? "Listening…" : predicted || placeholder}
      aria-describedby={predicted ? predictionDescription : undefined}
      onChange={(event) => onChange(event.target.value)}
      onPaste={(event) => {
        const files = imageFiles(event.clipboardData.files);
        if (files.length > 0) {
          event.preventDefault();
          void addPhotos(files);
        }
      }}
      onKeyDown={(event) => {
        if (predicted && !event.nativeEvent.isComposing) {
          if (
            event.key === "Tab" &&
            !event.shiftKey &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey
          ) {
            event.preventDefault();
            acceptPrediction();
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            prediction.dismiss();
            return;
          }
        }
        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }
      }}
      className={`min-w-0 flex-1 resize-none border-0 bg-transparent outline-none placeholder:text-[#A3A3A3] ${predicted ? "motion-safe:animate-[composer-suggestion-in_180ms_ease-out]" : ""} ${hero ? "text-base" : "col-span-3 col-start-1 row-start-1 w-full px-2 py-1.5 text-base sm:col-span-1 sm:col-start-2 sm:px-0 sm:py-2"}`}
    />
  );
  const useSuggestion = predicted ? (
    <button
      type="button"
      onClick={acceptPrediction}
      aria-label={`Use suggestion: ${predicted}`}
      className="col-start-2 row-start-2 h-11 w-max bg-transparent px-2 text-[13px] font-normal text-muted transition-colors hover:text-soft motion-safe:animate-[composer-suggestion-in_180ms_ease-out] sm:col-span-2 sm:col-start-2 sm:h-6 sm:justify-self-end sm:text-[11px]"
    >
      <span className="sm:hidden">Use suggestion</span>
      <span className="hidden sm:inline">Tab to use suggestion</span>
    </button>
  ) : null;
  return (
    <form
      data-composer
      onSubmit={(event) => {
        event.preventDefault();
        if (dictation.active) {
          dictation.stop();
        } else if (hasContent && preparing === 0) {
          onSubmit();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && dictation.active) {
          event.preventDefault();
          dictation.cancel();
        }
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        const files = imageFiles(event.dataTransfer.files);
        if (files.length > 0) {
          event.preventDefault();
          void addPhotos(files);
        }
      }}
      className={`relative w-full rounded-[24px] bg-white shadow-[0_0_0_1px_rgb(0_0_0/6%),0_1px_3px_rgb(0_0_0/4%),0_16px_40px_-16px_rgb(0_0_0/12%)] ${hero ? "flex flex-col gap-3 py-4 pr-4 pl-5" : "flex flex-col gap-2 py-2 pr-2 pl-2"}`}
    >
      {photoError ? (
        <div
          role="alert"
          className="pointer-events-none absolute bottom-full left-0 z-10 mb-3 w-max max-w-[min(320px,80vw)] animate-[fade-in_160ms_ease-out] rounded-[12px] bg-ink px-3.5 py-2.5 text-[13px] leading-snug text-white shadow-[0_1px_2px_rgb(0_0_0/8%),0_12px_32px_-8px_rgb(0_0_0/22%)]"
        >
          {photoError}
        </div>
      ) : null}
      <label htmlFor="message" className="sr-only">
        Message
      </label>
      <span id={predictionDescription} className="sr-only">
        {predicted
          ? `Suggested reply: “${predicted}”. Press Tab or choose Use suggestion to edit it before sending.`
          : ""}
      </span>
      {photos.length > 0 || preparing > 0 ? (
        <div className={hero ? "" : "px-2 pt-2"}>
          <PhotoStrip
            photos={photos}
            preparing={preparing}
            onRemove={(id) =>
              onPhotosChange((current) =>
                current.filter((photo) => photo.id !== id),
              )
            }
            onView={(index) =>
              setViewing({ urls: photos.map((photo) => photo.url), index })
            }
          />
        </div>
      ) : null}
      {viewing ? (
        <PhotoViewer viewing={viewing} onClose={() => setViewing(null)} />
      ) : null}
      {hero ? (
        <>
          {textarea}
          <div className="-ml-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {photoButton}
              {useSuggestion}
            </div>
            {controls}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-1 sm:items-end sm:gap-y-0">
          {photoButton}
          {textarea}
          {useSuggestion}
          <div className="col-start-3 row-start-2 flex min-h-11 items-center sm:row-start-1 sm:min-h-0">
            {controls}
          </div>
        </div>
      )}
    </form>
  );
}

function NeedsYou() {
  const [runs, setRuns] = useState<CheckoutView[]>([]);
  useEffect(() => {
    void runsNeedingYou(async (cursor) => {
      const response = await fetch(
        `/api/checkouts?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        { cache: "no-store" },
      );
      return response.ok ? ((await response.json()) as CheckoutPage) : null;
    })
      .then(setRuns)
      .catch(() => {});
  }, []);
  if (runs.length === 0) {
    return null;
  }
  const first = runs[0];
  return (
    <a
      href={`/checkouts/${encodeURIComponent(first.runId)}`}
      className="panel flex animate-[fade-in_240ms_ease-out] items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-well motion-reduce:animate-none"
    >
      <span className="size-2.5 flex-none rounded-full bg-attention shadow-[0_0_0_4px_var(--color-attention-soft)]" />
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="font-medium">
          {runs.length === 1
            ? "1 checkout needs you"
            : `${runs.length} checkouts need you`}
        </span>
        <span className="text-[13px] text-quiet">
          {first.store} ·{" "}
          {first.pending?.kind === "payment"
            ? "approve a payment"
            : "finish a secure step"}
        </span>
      </span>
      <Chevron className="text-muted" />
    </a>
  );
}

/** GitHub-flavoured markdown, so bare URLs become links too. */
const markdownPlugins = [remarkGfm];

/**
 * Relative links (our own pages) stay in the tab; anything else opens a new
 * one. Decided from the href alone, so server and client render alike.
 */
const markdown: Components = {
  a: ({ node: _, href, ...props }) => {
    const internal = typeof href === "string" && /^\/(?!\/)/.test(href);
    return internal ? (
      <a href={href} {...props} />
    ) : (
      <a href={href} {...props} target="_blank" rel="noreferrer" />
    );
  },
};

/** A new chat's example ask: the homepage's wording, naming a store where the visitor is. */
export interface ChatExample {
  readonly key: "usual" | "cart" | "table" | "tickets";
  readonly store: string;
  readonly logo: string;
}

export function Chat({
  sessionId,
  examples: asks = [],
}: {
  sessionId?: string;
  /** The new chat's example asks, above the composer. */
  examples?: readonly ChatExample[];
}) {
  const { m, f } = useI18n();
  const { refreshConversations } = useAccount();
  const [input, setInput] = useState("");
  const [photos, setPhotos] = useState<readonly Photo[]>([]);
  const [viewing, setViewing] = useState<Viewing | null>(null);
  // Photos of messages sent from this page, by their text: Eve's copy of a
  // message is text only until the server confirms it.
  const sentPhotosByText = useRef(new Map<string, readonly Photo[]>());
  function userContent(message: EveMessage) {
    if (
      message.metadata?.optimistic &&
      !message.parts.some((part) => part.type === "file")
    ) {
      const { text, files } = withoutFileLines(textOf(message));
      return {
        text,
        photos: files > 0 ? (sentPhotosByText.current.get(text) ?? []) : [],
      };
    }
    return { text: textOf(message), photos: photosOf(message) };
  }
  const [live, setLive] = useState<{
    runId: string;
    /** Opened with "Watch live" rather than by itself. */
    byUser: boolean;
  } | null>(null);
  // The live view opens by itself once per run, the first time its store
  // browser is working (a new checkout, or a running one in a reopened chat).
  // It takes over from the one on screen unless the user opened that one
  // themselves and its run is still going (not over, not being canceled).
  // Closing it keeps it closed. Narrow screens skip this: there the live view
  // covers the whole conversation, so it waits for "Watch live".
  const autoOpened = useRef(new Set<string>());
  const keepWatching = useRef<(runId: string) => boolean>(() => false);
  const onLive = useCallback((runId: string) => {
    if (autoOpened.current.has(runId)) {
      return;
    }
    autoOpened.current.add(runId);
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setLive((open) =>
        open?.byUser && keepWatching.current(open.runId)
          ? open
          : { runId, byUser: false },
      );
    }
  }, []);
  const [canceledHere, setCanceledHere] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const agent = useEveAgent({
    ...(sessionId
      ? { initialSession: { sessionId, streamIndex: 0 }, resume: true }
      : {}),
    onSessionChange(session) {
      if (!sessionId && session?.sessionId) {
        const next = `/c/${session.sessionId}`;
        if (window.location.pathname !== next) {
          window.history.replaceState(null, "", next);
          refreshConversations();
        }
      }
    },
  });
  const busy = agent.status === "submitted" || agent.status === "streaming";
  const resuming = agent.status === "resuming";
  const messages = useMemo(
    () => withoutConfirmedEchoes(agent.data.messages),
    [agent.data.messages],
  );
  // Scrolling follows ChatGPT/Claude: a sent message is pinned near the top
  // with room for the reply below; streaming never drags the view; an opened
  // conversation starts at its end; a button returns to the latest message.
  const [pinned, setPinned] = useState(false);
  const pinPending = useRef(false);
  const heroRect = useRef<DOMRect | null>(null);
  const lastUser = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLDivElement>(null);
  /** The latest turn; tall enough while pinned that the sent message can reach the top. */
  const turn = useRef<HTMLDivElement>(null);
  const footer = useRef<HTMLDivElement>(null);
  const endVisible = useRef(true);
  const [atEnd, setAtEnd] = useState(true);
  // Our own pin scroll briefly moves the latest content off screen.
  const [autoScrolling, setAutoScrolling] = useState(false);
  const opened = useRef(false);

  // Coming back from the secure page: let the agent pick the checkout back up.
  const continued = useRef(false);
  useEffect(() => {
    if (continued.current || agent.status !== "ready" || !sessionId) {
      return;
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get("continued") !== "1") {
      return;
    }
    continued.current = true;
    url.searchParams.delete("continued");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    void agent.send("I finished the secure step.");
  }, [agent, sessionId]);

  function send(
    text: string,
    fromComposer = true,
    attached: readonly Photo[] = fromComposer ? photos : [],
  ) {
    const message = text.trim();
    if ((!message && attached.length === 0) || resuming) {
      return;
    }
    if (fromComposer) {
      setInput("");
      setPhotos([]);
    }
    if (messages.length === 0) {
      heroRect.current =
        document.querySelector("[data-composer]")?.getBoundingClientRect() ??
        null;
    }
    if (attached.length > 0) {
      sentPhotosByText.current.set(message, attached);
    }
    pinPending.current = true;
    setPinned(true);
    void agent
      .send(
        photoMessage(message, attached),
        busy ? { turnPolicy: "steer" } : undefined,
      )
      .catch(() => {
        if (fromComposer) {
          setInput((current) => current || message);
          setPhotos((current) => (current.length > 0 ? current : attached));
        }
      });
  }

  // What the dock tells the agent. A note that can't go
  // yet (the conversation is reconnecting) waits here; cancelling a checkout
  // drops its waiting notes, so the agent never hears an answer after the
  // cancel and starts it again.
  const outbox = useRef<{ text: string; runId: string | null }[]>([]);
  function sendNote(text: string, about?: { runId: string; cancel?: boolean }) {
    if (about?.cancel) {
      outbox.current = outbox.current.filter(
        (note) => note.runId !== about.runId,
      );
    }
    if (resuming) {
      outbox.current.push({ text, runId: about?.runId ?? null });
      return;
    }
    send(text, false);
  }
  useEffect(() => {
    if (resuming || outbox.current.length === 0) {
      return;
    }
    const waiting = outbox.current;
    outbox.current = [];
    for (const note of waiting) {
      void agent.send(note.text, { turnPolicy: "steer" }).catch(() => {});
    }
  }, [resuming, agent]);

  // Every checkout the conversation mentions: where it first appears (a
  // one-line row), the message that last mentions it, the tool result where
  // the agent saw it end, and its latest snapshot.
  const mentions = useMemo(() => checkoutMentions(messages), [messages]);
  const { rendered, refs } = mentions;
  const views = useCheckouts(refs);

  // The agent asked where the user is (`request_location`): ask the browser
  // (its own permission prompt is the only UI), then answer the question
  // through Eve with the place or why there is none. A place shared earlier
  // in this conversation answers a repeat ask without asking again.
  const locationAsks = useMemo(
    () =>
      openConversationInputs(agent.conversation)
        .map((input) => input.request)
        .filter(
          (request) =>
            request.kind === "question" &&
            request.action.toolName === LOCATION_TOOL,
        ),
    [agent.conversation],
  );
  const located = useRef(
    new Map<
      string,
      { result: Located | null; sending: boolean; failures: number }
    >(),
  );
  const [locatedCount, setLocatedCount] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: locatedCount re-runs it when a lookup or an answer finishes
  useEffect(() => {
    for (const { requestId } of locationAsks) {
      const entry = located.current.get(requestId);
      if (!entry) {
        const started = { result: null, sending: false, failures: 0 };
        located.current.set(requestId, started);
        const remembered = rememberedPlace(messages);
        void (
          remembered
            ? Promise.resolve<Located>({ status: "shared", place: remembered })
            : locate()
        ).then((result) => {
          located.current.set(requestId, { ...started, result });
          setLocatedCount((count) => count + 1);
        });
        continue;
      }
      // Answer once located. A refused answer (say, the conversation was
      // reconnecting) is tried again, a few times at most.
      if (!entry.result || entry.sending || entry.failures >= 3 || resuming) {
        continue;
      }
      entry.sending = true;
      void agent
        .respond([{ requestId, ...locationAnswer(entry.result) }])
        .catch(() => {
          entry.sending = false;
          entry.failures += 1;
          setLocatedCount((count) => count + 1);
        });
    }
  }, [locationAsks, messages, resuming, agent, locatedCount]);
  const waitingCalls = useMemo(
    () => new Set(locationAsks.map((request) => request.action.callId)),
    [locationAsks],
  );

  // Runs the agent was asked to cancel, or the user canceled in the dock.
  const canceling = useMemo(
    () => canceledRuns(messages, canceledHere),
    [messages, canceledHere],
  );
  keepWatching.current = (runId) =>
    isActive(views.get(runId)) && !canceling.has(runId);
  const active = useMemo(
    () => [...views.values()].filter((view) => isActive(view)).sort(byUrgency),
    [views],
  );
  const [predictionRun, setPredictionRun] = useState<CheckoutView | null>(null);
  const prediction = usePrediction(
    messages,
    !resuming &&
      (agent.status === "ready" || predictionRun?.pending?.kind === "question"),
    predictionRun,
  );
  useEffect(() => {
    for (const view of views.values()) {
      if (view.status === "running" && view.liveViewUrl) {
        onLive(view.runId);
      }
    }
  }, [views, onLive]);
  // A live view that opened by itself closes a moment after its checkout
  // stops, so the outcome card isn't left beside (or, on phones, under) a
  // frame with nothing left to show. One the user opened stays until they close it.
  const liveEnded = live
    ? (() => {
        const view = views.get(live.runId);
        return Boolean(view && !isActive(view));
      })()
    : false;
  useEffect(() => {
    if (!live || live.byUser || !liveEnded) {
      return;
    }
    const timer = window.setTimeout(
      () =>
        setLive((current) =>
          current?.runId === live.runId && !current.byUser ? null : current,
        ),
      1500,
    );
    return () => window.clearTimeout(timer);
  }, [live, liveEnded]);

  // A run that settles while the conversation is open reports where the
  // reader is: at the end of the latest message. If the reader was at the
  // latest message, the outcome card scrolls into view.
  const wasActive = useRef(new Set<string>());
  const [endedAt, setEndedAt] = useState<Record<string, number>>({});
  useLayoutEffect(() => {
    for (const view of views.values()) {
      if (isActive(view)) {
        wasActive.current.add(view.runId);
      } else if (wasActive.current.delete(view.runId)) {
        const at = messages.length - 1;
        setEndedAt((current) => ({ ...current, [view.runId]: at }));
        if (endVisible.current) {
          requestAnimationFrame(() =>
            end.current?.scrollIntoView({ block: "end", behavior: "smooth" }),
          );
        }
      }
    }
  }, [views, messages.length]);
  // Where each settled run's outcome card goes: with the tool result where
  // the agent saw it end (its closing words follow), or else at the end of
  // the message where it ended (`part: null`).
  const outcomes = useMemo(
    () => placeOutcomes(mentions, views, endedAt),
    [mentions, views, endedAt],
  );
  const outcomeAt = (message: number, part: number | null) =>
    [...outcomes]
      .filter(([, at]) => at.message === message && at.part === part)
      .map(([runId]) => runId);

  const last = messages.at(-1);
  // The reply's latest visible step: words or a tool call. Reasoning and empty
  // text parts don't count, so the indicator stays until something shows.
  const step =
    last?.role === "assistant"
      ? last.parts.findLast(
          (part) =>
            (part.type === "text" && part.text.trim().length > 0) ||
            part.type === "dynamic-tool",
        )
      : undefined;
  // The reply is only following a checkout (the dock shows it): Stop would
  // stop the agent, not the purchase, so the composer offers Send instead. A
  // message sent now steers the agent; the dock's × cancels the checkout.
  const onlyFollowing =
    busy &&
    step?.type === "dynamic-tool" &&
    following.has(step.toolName) &&
    step.state !== "output-available" &&
    step.state !== "output-error";
  // Show the indicator whenever a reply is pending with nothing moving: before
  // its first words, during a tool without its own label, and after a tool
  // returns while the model decides what's next. Checkout tools in flight show
  // their own label, and a followed checkout shows on its card.
  const thinking =
    agent.status === "submitted" ||
    (busy &&
      (step === undefined ||
        (step.type === "dynamic-tool" &&
          (step.state === "output-available" ||
            step.state === "output-error" ||
            !(
              step.toolName in activity ||
              following.has(step.toolName) ||
              stepTools.has(step.toolName) ||
              step.toolName === LOCATION_TOOL
            )))));
  // A new phrase for each reply, kept steady while that reply is pending.
  const userTurns = messages.filter(
    (message) => message.role === "user",
  ).length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-pick once per user turn
  const phrase = useMemo(() => randomThinkingPhrase(), [userTurns]);
  const failed = agent.status === "error" && !busy;
  // A local dev restart drops conversations: one the server no longer has, or
  // that can't accept messages, has ended. Any other failure to load (network,
  // a server error) is worth a retry, not the end of the conversation.
  const error = agent.error as { code?: string; status?: number } | undefined;
  const unloaded = Boolean(sessionId) && messages.length === 0 && failed;
  const ended =
    error?.code === "session_not_active" ||
    (unloaded && (error?.status === 403 || error?.status === 404));
  const empty = messages.length === 0 && !sessionId;
  const lastUserIndex = messages.findLastIndex(
    (message) => message.role === "user",
  );

  // Pin the message just sent near the top of the view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when a new user message renders
  useLayoutEffect(() => {
    const element = lastUser.current;
    if (!pinPending.current || !element) {
      return;
    }
    pinPending.current = false;
    if (heroRect.current) {
      // A brand-new chat already starts at the top; the composer animates instead.
      return;
    }
    const offset = window.innerWidth < 768 ? 80 : 24;
    const top = element.getBoundingClientRect().top + window.scrollY - offset;
    // The turn's min-height only estimates the composer and dock below it; if
    // the page still can't scroll that far, the previous reply would peek in
    // at the top, so make up the difference.
    const box = turn.current;
    if (box) {
      box.style.minHeight = "";
      const short =
        top - (document.documentElement.scrollHeight - window.innerHeight);
      if (short > 0) {
        box.style.minHeight = `${box.offsetHeight + Math.ceil(short)}px`;
      }
    }
    setAutoScrolling(true);
    window.scrollTo({
      top: Math.max(0, top),
      behavior: "smooth",
    });
    window.setTimeout(() => setAutoScrolling(false), 900);
  }, [lastUserIndex]);

  // First message of a new chat: slide the composer down and fade the rest in.
  useLayoutEffect(() => {
    const from = heroRect.current;
    const form = document.querySelector<HTMLElement>("[data-composer]");
    if (empty || !from || !form) {
      return;
    }
    heroRect.current = null;
    const to = form.getBoundingClientRect();
    form.animate(
      [
        { transform: `translateY(${from.top - to.top}px)` },
        { transform: "none" },
      ],
      { duration: 480, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    column.current?.animate(
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 360, delay: 140, easing: "ease-out", fill: "backwards" },
    );
  }, [empty]);

  // An opened conversation starts at its latest message, and stays there while
  // it settles (checkout cards load, the live view opens) until the reader
  // scrolls, types or clicks.
  useEffect(() => {
    if (opened.current || !sessionId || resuming || messages.length === 0) {
      return;
    }
    opened.current = true;
    const observer = new ResizeObserver(() =>
      end.current?.scrollIntoView({ block: "end", behavior: "auto" }),
    );
    // The checkout dock arriving above the composer counts as settling too.
    for (const element of [column.current, footer.current]) {
      if (element) {
        observer.observe(element);
      }
    }
    const inputs = ["wheel", "touchmove", "keydown", "pointerdown"] as const;
    const settled = () => {
      observer.disconnect();
      window.clearTimeout(timer);
      for (const input of inputs) {
        window.removeEventListener(input, settled);
      }
    };
    const timer = window.setTimeout(settled, 5000);
    for (const input of inputs) {
      window.addEventListener(input, settled, { passive: true });
    }
  }, [sessionId, resuming, messages.length]);

  // Whether the latest content is on screen above the composer (and dock),
  // kept current on scroll and whenever the conversation or the composer area
  // changes size. The dock changes that area's height as it opens, grows and
  // closes: if the latest message was in view, scroll with it in the same
  // frame so nothing slides under the dock.
  useLayoutEffect(() => {
    const bottom = footer.current;
    const content = column.current;
    if (empty || !bottom || !content) {
      return;
    }
    const measure = () => {
      const last = end.current?.getBoundingClientRect().bottom;
      const visible =
        last === undefined || last <= bottom.getBoundingClientRect().top - 4;
      endVisible.current = visible;
      setAtEnd(visible);
    };
    let previous = bottom.offsetHeight;
    const footerObserver = new ResizeObserver(() => {
      const height = bottom.offsetHeight;
      const growth = height - previous;
      previous = height;
      if (end.current) {
        end.current.style.scrollMarginBottom = `${height + 48}px`;
      }
      // The area grows upward from the bottom of the screen, so its top a
      // moment ago was `growth` lower than now.
      const last = end.current?.getBoundingClientRect().bottom;
      const top = bottom.getBoundingClientRect().top;
      if (growth > 0 && last !== undefined && last <= top + growth - 4) {
        const overlap = last + 16 - top;
        if (overlap > 0) {
          window.scrollBy({ top: overlap, behavior: "instant" });
        }
      }
      measure();
    });
    const contentObserver = new ResizeObserver(measure);
    footerObserver.observe(bottom);
    contentObserver.observe(content);
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      footerObserver.disconnect();
      contentObserver.disconnect();
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [empty]);

  // Keep the sidebar title current: re-title after every completed reply and
  // whenever a checkout starts (checkouts hold the turn open for minutes).
  const { conversations: listed } = useAccount();
  const activeSession = agent.session?.sessionId ?? sessionId;
  const titled = useRef<{ replies: number; runs: Set<string> } | null>(null);
  useEffect(() => {
    if (!activeSession || resuming || messages.length === 0) {
      return;
    }
    const replies = messages.filter(
      (message) => message.role === "assistant" && textOf(message),
    ).length;
    const runs = rendered.flat().flatMap((run) => (run ? [run] : []));
    if (titled.current === null) {
      // A reopened chat keeps its title until something new happens.
      titled.current = sessionId
        ? { replies, runs: new Set(runs.map((run) => run.runId)) }
        : { replies: 0, runs: new Set() };
    }
    const seen = titled.current;
    const newRun = runs.find((run) => !seen.runs.has(run.runId));
    const newReply = !busy && replies > seen.replies;
    if (!newRun && !newReply) {
      return;
    }
    seen.replies = Math.max(seen.replies, busy ? seen.replies : replies);
    for (const run of runs) {
      seen.runs.add(run.runId);
    }
    const transcript = messages
      .map(
        (message) =>
          `${message.role === "user" ? "User" : "Assistant"}: ${textOf(message)}`,
      )
      .concat(
        newRun?.view?.task ? [`Checkout started: ${newRun.view.task}`] : [],
      )
      .join("\n")
      .slice(-6000);
    const current =
      listed?.find((conversation) => conversation.sessionId === activeSession)
        ?.title ?? null;
    void fetch(
      `/api/conversations/${encodeURIComponent(activeSession)}/title`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, current }),
      },
    ).then((response) => {
      if (response.ok) {
        refreshConversations();
      }
    });
  }, [
    activeSession,
    busy,
    resuming,
    messages,
    rendered,
    sessionId,
    listed,
    refreshConversations,
  ]);

  // An ended conversation can't come back; drop it from the sidebar.
  useEffect(() => {
    if (ended && sessionId) {
      void fetch(`/api/conversations/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      }).then(() => refreshConversations());
    }
  }, [ended, sessionId, refreshConversations]);

  function renderMessage(message: EveMessage, index: number) {
    // Outcomes that land after this message (the end of the conversation
    // when the run settled).
    const after = outcomeAt(index, null).map((runId) => (
      <CheckoutCard key={runId} runId={runId} initial={views.get(runId)} />
    ));
    const { text, photos: sentPhotos } =
      message.role === "user" ? userContent(message) : { text: "", photos: [] };
    // What a checkout tool part shows: a checkout's first mention is a row;
    // its outcome is a full card where the agent saw it end (the same spot
    // for a run that was already over when it came up); a call in flight
    // shows what it's doing.
    const checkoutAt = (part: ToolPart, partIndex: number) => {
      const first = rendered[index]?.[partIndex];
      const outcomes = outcomeAt(index, partIndex);
      const label = activity[part.toolName];
      return {
        row: first && !outcomes.includes(first.runId) ? first : null,
        outcomes,
        working:
          label &&
          (part.state === "input-streaming" || part.state === "input-available")
            ? label
            : null,
      };
    };
    // Web searches and page reads in a row (nothing visible between them)
    // share one research row, keyed by the first so it keeps its state.
    const steps =
      message.role === "assistant"
        ? groupSteps(
            message.parts,
            busy && index === messages.length - 1,
            (part, partIndex) => {
              if (part.type === "text") {
                return part.text.trim().length > 0;
              }
              if (part.type !== "dynamic-tool") {
                return false;
              }
              if (part.toolName === LOCATION_TOOL) {
                return true;
              }
              const shown = checkoutAt(part, partIndex);
              return Boolean(
                shown.row || shown.outcomes.length > 0 || shown.working,
              );
            },
          )
        : null;
    return message.role === "user" ? (
      <Fragment key={message.id}>
        {readDockNote(text) ? (
          <div
            ref={index === lastUserIndex ? lastUser : undefined}
            className="flex justify-end"
          >
            <DockNoteLine text={text} />
          </div>
        ) : (
          <div
            ref={index === lastUserIndex ? lastUser : undefined}
            className="flex max-w-[82%] flex-col items-end gap-1.5 self-end"
          >
            {sentPhotos.length > 0 ? (
              <div className="flex flex-wrap justify-end gap-1.5">
                {sentPhotos.map((photo, photoIndex) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() =>
                      setViewing({
                        urls: sentPhotos.map((sent) => sent.url),
                        index: photoIndex,
                      })
                    }
                    aria-label="View photo"
                    className="block max-w-full cursor-zoom-in"
                  >
                    {/* biome-ignore lint/performance/noImgElement: a data: URL from the message */}
                    <img
                      src={photo.url}
                      alt=""
                      className={`rounded-[16px] object-cover ring-1 ring-black/[0.06] ${sentPhotos.length === 1 ? "max-h-72 max-w-full" : "size-32 sm:size-40"}`}
                    />
                  </button>
                ))}
              </div>
            ) : null}
            {text ? (
              <div className="rounded-[20px_20px_6px_20px] bg-chip px-4 py-3 text-[15px] whitespace-pre-wrap [overflow-wrap:anywhere]">
                {text}
              </div>
            ) : null}
          </div>
        )}
        {after}
      </Fragment>
    ) : (
      <div
        key={message.id}
        className="flex min-w-0 flex-col gap-3.5 empty:hidden"
      >
        {message.parts.map((part, partIndex) => {
          const key = `${message.id}-${partIndex}`;
          if (part.type === "text" && part.text.trim()) {
            return (
              <div
                key={key}
                className="prose-chat text-[15px] [overflow-wrap:anywhere]"
              >
                <Markdown remarkPlugins={markdownPlugins} components={markdown}>
                  {part.text}
                </Markdown>
              </div>
            );
          }
          if (part.type !== "dynamic-tool") {
            return null;
          }
          if (stepTools.has(part.toolName)) {
            const run = steps?.get(partIndex);
            return run ? <ToolSteps key={key} steps={run} /> : null;
          }
          if (part.toolName === LOCATION_TOOL) {
            return (
              <LocationStep
                key={key}
                step={readLocationStep(
                  part,
                  waitingCalls.has(part.toolCallId) ||
                    (busy && index === messages.length - 1),
                )}
              />
            );
          }
          const { row, outcomes, working } = checkoutAt(part, partIndex);
          return (
            <Fragment key={key}>
              {row ? (
                <CheckoutRow runId={row.runId} initial={row.view} />
              ) : null}
              {outcomes.map((runId) => (
                <CheckoutCard
                  key={runId}
                  runId={runId}
                  initial={views.get(runId)}
                />
              ))}
              {working ? <Working>{working}</Working> : null}
            </Fragment>
          );
        })}
        {after}
      </div>
    );
  }

  if (empty) {
    return (
      <main className="flex min-h-dvh flex-col">
        <BackHeader
          href="/home"
          title={m.app.nav.chat}
          tool={<ChatHistory />}
          className="px-2 md:hidden"
        />
        <div className="flex flex-1 flex-col items-center justify-center px-6 pt-12 pb-8">
          <div className="flex w-full max-w-[680px] flex-col items-center gap-8">
            <div className="relative flex flex-col items-center gap-2.5 text-center">
              <AddressNudge />
              <h1 className="text-[34px] leading-[1.05] font-semibold tracking-[-0.045em] text-balance sm:text-[40px]">
                What do you want to buy?
              </h1>
              <p className="max-w-[460px] text-[15px] text-pretty text-quiet">
                Describe it, paste a link, or add a photo. I find it, run the
                checkout, and pay only within spending limits you approve.
              </p>
            </div>
            {asks.length > 0 ? (
              // The homepage's ask bubbles, at stores where the visitor is: a tap puts one in the box.
              <div className="-mb-3 flex w-full flex-wrap justify-center gap-2">
                {asks.map((ask) => {
                  const text = f(m.landing.how.examples[ask.key], {
                    store: ask.store,
                  });
                  return (
                    <button
                      key={ask.key}
                      type="button"
                      onClick={() => {
                        setInput(text);
                        document.getElementById("message")?.focus();
                      }}
                      className="inline-flex max-w-full min-w-0 items-center gap-2.5 rounded-[18px] rounded-br-md bg-[#f9f9f9] py-2 pr-3.5 pl-2.5 text-left text-[14px] leading-snug text-soft ring-1 ring-black/[0.04] transition-colors ring-inset hover:bg-chip hover:text-ink"
                    >
                      <Image
                        src={ask.logo}
                        alt=""
                        width={22}
                        height={22}
                        unoptimized
                        className="size-[22px] flex-none rounded-[6px] bg-white object-contain ring-1 ring-black/5"
                      />
                      <span className="truncate">{text}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            <Composer
              hero
              prediction={prediction}
              value={input}
              onChange={setInput}
              photos={photos}
              onPhotosChange={setPhotos}
              onSubmit={() => send(input)}
              onStop={() => void agent.cancel()}
              busy={busy && !onlyFollowing}
              disabled={false}
              placeholder="Describe what you want, or paste a link"
            />
            <button
              type="button"
              onClick={() => {
                setInput("Buy this for me: ");
                document.getElementById("message")?.focus();
              }}
              className="tap relative -mt-3 text-[13px] text-muted underline decoration-[#d4d4d4] underline-offset-[3px] hover:text-ink"
            >
              Or paste a product link
            </button>
            <div className="mt-2 grid w-full grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-3">
              <NeedsYou />
            </div>
          </div>
        </div>
      </main>
    );
  }

  // `data-chat` turns off the browser's scroll anchoring (style.css): the
  // conversation manages its own scroll, and anchoring would jump the view
  // when a card lands at the end or the dock changes size.
  return (
    <div className="flex min-h-dvh">
      <main data-chat className="relative isolate flex min-w-0 flex-1 flex-col">
        <BackHeader
          href="/home"
          title={m.app.nav.chat}
          tool={<ChatHistory />}
          className="px-2 md:hidden"
        />
        <div className="flex flex-1 justify-center px-5 pt-10 pb-6 md:px-8">
          <div
            ref={column}
            className="flex w-full max-w-[680px] flex-col gap-7"
          >
            {messages.length === 0 && !failed ? <ConversationSkeleton /> : null}
            {messages
              .slice(0, Math.max(lastUserIndex, 0))
              .map((message, index) => renderMessage(message, index))}
            <div
              ref={turn}
              className={`flex flex-col gap-7 ${pinned ? "min-h-[calc(100dvh-160px)] max-md:min-h-[calc(100dvh-216px)]" : ""}`}
            >
              {messages
                .slice(Math.max(lastUserIndex, 0))
                .map((message, offset) =>
                  renderMessage(message, Math.max(lastUserIndex, 0) + offset),
                )}
              {thinking ? <Working>{phrase}</Working> : null}
              {failed ? (
                <div className="panel flex items-center gap-3 rounded-[16px] px-4 py-3">
                  <span className="flex-1">
                    {ended
                      ? "This conversation has ended. Continue in a new chat."
                      : unloaded
                        ? "I couldn't load this conversation."
                        : "I couldn't finish that reply."}
                  </span>
                  {ended ? (
                    <a
                      href="/chat"
                      className="raised inline-flex h-8 items-center rounded-full bg-ink px-3.5 font-medium text-white hover:bg-ink-hover"
                    >
                      New chat
                    </a>
                  ) : unloaded ? (
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="raised-light h-8 rounded-full border border-line-card bg-white px-3.5 font-medium text-soft hover:text-ink"
                    >
                      Reload
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const lastUser = [...messages]
                          .reverse()
                          .find((m) => m.role === "user");
                        if (lastUser) {
                          const last = userContent(lastUser);
                          // Not from the composer: a draft typed meanwhile stays.
                          send(last.text, false, last.photos);
                        }
                      }}
                      className="raised-light h-8 rounded-full border border-line-card bg-white px-3.5 font-medium text-soft hover:text-ink"
                    >
                      Try again
                    </button>
                  )}
                </div>
              ) : null}
              <div ref={end} className="scroll-mb-36" />
            </div>
          </div>
        </div>
        <div
          ref={footer}
          className="sticky bottom-0 flex justify-center bg-gradient-to-t from-white via-white to-white/0 px-5 pt-4 pb-6 md:px-8"
        >
          <div className="relative w-full max-w-[680px]">
            {!atEnd && !autoScrolling && messages.length > 0 ? (
              <button
                type="button"
                aria-label="Scroll to latest"
                onClick={() =>
                  end.current?.scrollIntoView({
                    block: "end",
                    behavior: "smooth",
                  })
                }
                className="raised-light absolute -top-12 left-1/2 inline-flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-line-card bg-white text-soft hover:text-ink"
              >
                <ArrowUp className="rotate-180" />
              </button>
            ) : null}
            <CheckoutDock
              runs={active}
              onShownChange={setPredictionRun}
              liveRunId={live?.runId ?? null}
              onWatchLive={(runId) =>
                setLive((open) =>
                  open?.runId === runId ? null : { runId, byUser: true },
                )
              }
              onCanceling={(runId) =>
                setCanceledHere((current) => new Set(current).add(runId))
              }
              onDone={sendNote}
            />
            <Composer
              prediction={prediction}
              value={input}
              onChange={setInput}
              photos={photos}
              onPhotosChange={setPhotos}
              onSubmit={() => send(input)}
              onStop={() => void agent.cancel()}
              busy={busy && !onlyFollowing}
              disabled={resuming}
              placeholder="Message Menta"
            />
          </div>
        </div>
      </main>
      {live ? (
        <LiveView runId={live.runId} onClose={() => setLive(null)} />
      ) : null}
      {viewing ? (
        <PhotoViewer viewing={viewing} onClose={() => setViewing(null)} />
      ) : null}
    </div>
  );
}
