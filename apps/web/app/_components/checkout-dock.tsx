"use client";

import { shortTask } from "@oca/agent/task";
import {
  CancelButton,
  type Draft,
  type FormEntry,
  formAnswers,
  MoreButton,
  PaymentStep,
  RequestForm,
  RunHeader,
  runStatus,
  Settled,
  useUi,
  WatchButton,
} from "@oca/agent/ui";
import dynamic from "next/dynamic";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  type CheckoutView,
  checkoutAction,
  dockNote,
  nextChoice,
  shownRun,
  stepLine,
  useNow,
} from "../../lib/client/checkouts";
import { useI18n } from "../../lib/i18n/client";
import { CheckoutNotifications } from "./checkout-notifications";
import type { ProtectedInputHandle } from "./crossmint";

/** Crossmint's SDK loads only when a step needs it. */
const Crossmint = {
  Scope: dynamic(() => import("./crossmint").then((m) => m.CrossmintScope), {
    ssr: false,
  }),
  Approve: dynamic(() => import("./crossmint").then((m) => m.ApprovePayment), {
    ssr: false,
  }),
  ProtectedInput: dynamic(
    () => import("./crossmint").then((m) => m.ScopedProtectedInput),
    { ssr: false },
  ),
};

/** How far the composer overlaps the dock, so the two read as one surface. */
const TUCK = 24;

type Pending = NonNullable<CheckoutView["pending"]>;
type Question = Extract<Pending, { kind: "question" }>;
type Protected = Extract<Pending, { kind: "protected" }>;
type Payment = Extract<Pending, { kind: "payment" }>;
type Answered = Record<string, Record<string, Draft>>;

/**
 * Whether an on-screen keyboard is up for the message box: the visual
 * viewport is well short of its tallest while the composer has focus. The
 * dock folds to one line then, so the conversation stays visible.
 */
function useTypingOnTouch() {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }
    let tallest = viewport.height;
    const check = () => {
      tallest = Math.max(tallest, viewport.height);
      setTyping(
        document.activeElement?.id === "message" &&
          viewport.height < tallest - 120,
      );
    };
    viewport.addEventListener("resize", check);
    window.addEventListener("focusin", check);
    window.addEventListener("focusout", check);
    return () => {
      viewport.removeEventListener("resize", check);
      window.removeEventListener("focusin", check);
      window.removeEventListener("focusout", check);
    };
  }, []);
  return typing;
}

/**
 * One store request (a question, or one with private fields) answered right
 * here, in the shared form (`@oca/agent/ui`, also the ChatGPT/Claude
 * card's). Private fields are Crossmint's protected inputs: their values go
 * from Crossmint's iframe to the store, and only a `protectedInputId` comes
 * back. The composer still works for a typed reply to an ordinary question.
 */
export function RequestStep({
  view,
  pending,
  sent,
  onSent,
  page = false,
  secretNote,
}: {
  view: CheckoutView;
  pending: Question | Protected;
  sent: Record<string, Draft> | undefined;
  onSent: (drafts: Record<string, Draft>, message: string) => void;
  /** On the secure page: no inner scroll box, and the private note speaks for the page. */
  page?: boolean;
  /** The secure page's private note, when it names the assistant; else the plain one. */
  secretNote?: ReactNode;
}) {
  const { m, f } = useI18n();
  const handles = useRef(new Map<string, ProtectedInputHandle | null>());
  const entries: FormEntry[] =
    pending.kind === "question"
      ? pending.fields.map((field) => ({ kind: "standard", field }))
      : pending.fields.flatMap((field): FormEntry[] => {
          if (field.handling === "protected") {
            return [{ kind: "protected", field }];
          }
          const standard = pending.standard.find(
            (item) => item.key === field.key,
          );
          return standard ? [{ kind: "standard", field: standard }] : [];
        });
  return (
    <RequestForm
      {...(page
        ? {
            scrollClassName: "",
            chat: false,
            secretNote:
              secretNote ??
              f(m.checkout.store.secretNote, { store: view.store }),
          }
        : {})}
      requestId={pending.requestId}
      question={pending.question}
      expiresAt={pending.expiresAt}
      entries={entries}
      sent={sent}
      wrapSecret={(content) => (
        <Crossmint.Scope>{() => content}</Crossmint.Scope>
      )}
      renderProtected={(field, locked) => (
        <Crossmint.ProtectedInput
          ref={(handle: ProtectedInputHandle | null) => {
            handles.current.set(field.key, handle);
          }}
          field={
            (pending.kind === "protected"
              ? pending.fields.find((item) => item.key === field.key)
              : field) as never
          }
          disabled={locked}
        />
      )}
      onSubmit={async (submission, drafts) => {
        if (submission.kind === "instead") {
          await checkoutAction(view.runId, {
            action: "alternative",
            requestId: pending.requestId,
            text: submission.text,
          });
          onSent(
            drafts,
            dockNote(view, {
              kind: "answer",
              said: [{ label: "Instead", value: submission.text }],
              secure: false,
            }),
          );
          return;
        }
        const collected: Record<string, unknown> = { ...submission.answers };
        for (const entry of entries) {
          if (entry.kind !== "protected") {
            continue;
          }
          const handle = handles.current.get(entry.field.key);
          if (!handle) {
            throw new Error("The secure field isn't ready yet. Try again.");
          }
          const result = await handle.collect();
          if (result.status !== "collected") {
            throw new Error(result.message);
          }
          collected[entry.field.key] = result.input;
        }
        await checkoutAction(view.runId, {
          action: "answer",
          requestId: pending.requestId,
          answers: collected,
        });
        onSent(
          drafts,
          dockNote(view, {
            kind: "answer",
            // The agent reads it in English, as the card writes its notes;
            // `submission.said` is in the user's language.
            said: formAnswers(
              entries.flatMap((entry) =>
                entry.kind === "standard" ? [entry.field] : [],
              ),
              drafts,
            ).said,
            secure: submission.secret,
          }),
        );
      }}
    />
  );
}

/**
 * Payment approval inside the signed-in app: the shared payment step with
 * our saved-card list and Approve button and Crossmint's card checks. It
 * yields an `orderIntentId` that our server submits to the run; nothing else
 * (and never the model) can approve a payment.
 */
export function PaymentForm({
  view,
  pending,
  sent,
  onSent,
  page = false,
}: {
  view: CheckoutView;
  pending: Payment;
  sent: boolean;
  onSent: (message: string) => void;
  /** On the secure page: the card list isn't held in a scroll box. */
  page?: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  return (
    <PaymentStep
      amount={pending.amount}
      merchant={pending.merchant.name}
      expiresAt={pending.expiresAt}
      shipsTo={view.shipsTo}
      phase={sent ? "sent" : sending ? "sending" : "form"}
      error={error}
      onRetry={() => {
        setError("");
        setAttempt((current) => current + 1);
      }}
    >
      <div
        className={
          page
            ? ""
            : "max-h-[min(48dvh,460px)] overflow-y-auto overscroll-contain rounded-[16px] p-0.5"
        }
      >
        <Settled label="Loading your cards…">
          <Crossmint.Scope>
            {() => (
              <Crossmint.Approve
                key={attempt}
                request={{
                  amount: {
                    value: pending.amount.amount,
                    currency: pending.amount.currency,
                  },
                  merchant: {
                    name: pending.merchant.name,
                    url: pending.merchant.url,
                    countryCode: pending.merchant.countryCode,
                  },
                  // The limit's purpose: the task as people read it (links as
                  // their domain), 255 characters at most, like every other.
                  description: (
                    (view.task ? shortTask(view.task) : "") ||
                    `Purchase at ${view.store}`
                  )
                    .slice(0, 255)
                    .trimEnd(),
                  ...(pending.expiresAt
                    ? { expiresAt: pending.expiresAt }
                    : {}),
                }}
                onAuthorized={async (orderIntentId) => {
                  setSending(true);
                  setError("");
                  try {
                    await checkoutAction(view.runId, {
                      action: "approve",
                      requestId: pending.requestId,
                      orderIntentId,
                    });
                    onSent(dockNote(view, { kind: "approval" }));
                  } catch (cause) {
                    setError(
                      cause instanceof Error ? cause.message : String(cause),
                    );
                  } finally {
                    setSending(false);
                  }
                }}
              />
            )}
          </Crossmint.Scope>
        </Settled>
      </div>
    </PaymentStep>
  );
}

function Body({
  view,
  sent,
  onSent,
}: {
  view: CheckoutView;
  sent: Record<string, Draft> | undefined;
  onSent: (drafts: Record<string, Draft>, message: string) => void;
}) {
  const pending = view.pending;
  if (pending?.kind === "payment") {
    return (
      <PaymentForm
        key={pending.requestId}
        view={view}
        pending={pending}
        sent={Boolean(sent)}
        onSent={(message) => onSent({}, message)}
      />
    );
  }
  if (pending) {
    return (
      <RequestStep
        key={pending.requestId}
        view={view}
        pending={pending}
        sent={sent}
        onSent={onSent}
      />
    );
  }
  return null;
}

function DockRun({
  view,
  others,
  onNext,
  liveOpen,
  onWatchLive,
  canceling,
  onCancel,
  sent,
  onSent,
}: {
  view: CheckoutView;
  others: number;
  onNext: () => void;
  liveOpen: boolean;
  onWatchLive: (runId: string) => void;
  canceling: boolean;
  onCancel: () => Promise<void>;
  sent: Record<string, Draft> | undefined;
  onSent: (drafts: Record<string, Draft>, message: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  // What needs the user shows unfolded, except while they type on a phone.
  // Tapping the header flips that for the current request until the typing
  // state changes; a new request starts over.
  const typing = useTypingOnTouch();
  const [flipped, setFlipped] = useState<{
    requestId: string;
    typing: boolean;
  } | null>(null);
  const pending = view.pending;
  const hasBody = Boolean(pending) && !canceling;
  const flip =
    flipped?.requestId === pending?.requestId && flipped?.typing === typing;
  const open = hasBody && typing === flip;
  const status = runStatus(view, { canceling, sent: Boolean(sent) }, useUi());
  // While it just works, the header says what it's doing; anything that
  // needs the user (or a cancel or answer in flight) says that instead.
  const now = useNow(15_000);
  const line =
    canceling || sent || pending || view.status === "queued"
      ? null
      : stepLine(view, now);
  // Escape backs out of the confirm, from either button.
  const backOut = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setConfirming(false);
    }
  };
  return (
    <div className="flex animate-[fade-in_240ms_ease-out] flex-col">
      {confirming ? (
        <div className="flex h-9 items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate pl-1 text-[13px] font-medium">
            Cancel this checkout?
          </span>
          <button
            type="button"
            // The safe choice takes focus, so a stray Enter doesn't cancel.
            autoFocus
            onKeyDown={backOut}
            onClick={() => setConfirming(false)}
            className="h-8 flex-none rounded-full px-3 text-[13px] font-medium text-soft transition-colors hover:text-ink"
          >
            Keep going
          </button>
          <button
            type="button"
            onKeyDown={backOut}
            onClick={async () => {
              setConfirming(false);
              setError("");
              try {
                await onCancel();
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : String(cause),
                );
              }
            }}
            className="raised h-8 flex-none rounded-full bg-ink px-3.5 text-[13px] font-medium text-on-ink hover:bg-ink-hover"
          >
            Cancel checkout
          </button>
        </div>
      ) : (
        <RunHeader
          tone={status.tone}
          store={view.store}
          status={status.label}
          line={line}
          expand={{
            open,
            enabled: hasBody,
            onToggle: () =>
              setFlipped(
                flip || !pending
                  ? null
                  : { requestId: pending.requestId, typing },
              ),
          }}
        >
          {others > 0 ? <MoreButton others={others} onClick={onNext} /> : null}
          {view.liveViewUrl ? (
            <WatchButton
              open={liveOpen}
              onClick={() => onWatchLive(view.runId)}
            />
          ) : null}
          {canceling ? null : (
            <CancelButton onClick={() => setConfirming(true)} />
          )}
        </RunHeader>
      )}
      {!canceling &&
      !confirming &&
      ["queued", "running", "awaiting_input"].includes(view.status) ? (
        <CheckoutNotifications />
      ) : null}
      {error ? (
        <span className="px-1 pt-1 text-xs text-danger">{error}</span>
      ) : null}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="min-h-0 overflow-clip" inert={!open}>
          <div
            key={pending?.requestId}
            className="animate-[fade-in_240ms_ease-out] px-1 pt-2 pb-1"
          >
            <Body view={view} sent={sent} onSent={onSent} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The checkouts in this conversation that are still going, docked on top of
 * the composer: the one that needs the user most, with what it needs. Payment
 * and private fields use Crossmint's own components, right here.
 */
export function CheckoutDock({
  runs,
  liveRunId,
  onWatchLive,
  onCanceling,
  onDone,
  onShownChange,
}: {
  /** Active runs, most urgent first. */
  runs: readonly CheckoutView[];
  /** The same run the user sees, for composer predictions. Null after answering. */
  onShownChange?: (run: CheckoutView | null) => void;
  liveRunId: string | null;
  onWatchLive: (runId: string) => void;
  /** The user asked to cancel this run. */
  onCanceling?: (runId: string) => void;
  /**
   * The user answered, approved or cancelled here; this line tells the
   * agent so it keeps going (or, after a cancel, stays put). `about` names the
   * checkout it's about.
   */
  onDone: (
    message: string,
    about?: { runId: string; cancel?: boolean },
  ) => void;
}) {
  const [canceling, setCanceling] = useState<ReadonlySet<string>>(new Set());
  const [answered, setAnswered] = useState<Answered>({});
  // The user can switch to another run; a new request anywhere resets that.
  const [chosen, setChosen] = useState<{ runId: string; needs: string }>();
  const top = shownRun(runs, chosen);
  const predictionRun =
    top &&
    !canceling.has(top.runId) &&
    !(top.pending && answered[top.pending.requestId])
      ? top
      : null;
  useEffect(() => {
    onShownChange?.(predictionRun);
  }, [predictionRun, onShownChange]);
  // Keep the last thing on screen while the dock closes.
  const last = useRef<CheckoutView>(undefined);
  if (top) {
    last.current = top;
  }
  const shown = last.current;
  const open = Boolean(top);

  // The dock eases in and out, and into any sudden change of its content (a
  // new run or request, Crossmint's form loading). Small changes it tracks
  // frame by frame. Either way the composer below and the conversation's
  // scroll follow it.
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = outer.current;
    const content = inner.current;
    if (!box || !content) {
      return;
    }
    let opening = true;
    const fit = () => {
      const target = open ? content.offsetHeight : 0;
      const jump = Math.abs(target - box.getBoundingClientRect().height) > 24;
      box.style.transition = opening || jump ? "" : "none";
      box.style.height = `${target}px`;
      box.style.marginBottom = open ? `${-TUCK}px` : "0px";
      box.style.opacity = open ? "1" : "0";
    };
    fit();
    const timer = window.setTimeout(() => {
      opening = false;
    }, 320);
    const observer = new ResizeObserver(fit);
    observer.observe(content);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [open]);

  return (
    <div
      ref={outer}
      inert={!open}
      style={{ height: 0, marginBottom: 0, opacity: 0 }}
      className="relative overflow-clip transition-[height,margin-bottom,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
    >
      <section
        ref={inner}
        aria-label="Checkout in progress"
        style={{ paddingBottom: TUCK + 8 }}
        className="@container rounded-t-[24px] bg-well px-3 pt-2 shadow-[inset_0_0_0_1px_rgb(0_0_0/6%)]"
      >
        {shown ? (
          <DockRun
            key={shown.runId}
            view={shown}
            others={Math.max(runs.length - 1, 0)}
            onNext={() => {
              const next = nextChoice(runs, shown.runId);
              if (next) {
                setChosen(next);
              }
            }}
            liveOpen={liveRunId === shown.runId}
            onWatchLive={onWatchLive}
            canceling={canceling.has(shown.runId)}
            onCancel={async () => {
              const runId = shown.runId;
              setCanceling((current) => new Set(current).add(runId));
              onCanceling?.(runId);
              try {
                await checkoutAction(runId, { action: "cancel" });
              } catch (cause) {
                setCanceling((current) => {
                  const next = new Set(current);
                  next.delete(runId);
                  return next;
                });
                throw cause;
              }
              // Only once Crossmint took the cancel: the agent confirms and stops.
              onDone(dockNote(shown, { kind: "cancel" }), {
                runId,
                cancel: true,
              });
            }}
            sent={shown.pending ? answered[shown.pending.requestId] : undefined}
            onSent={(drafts, message) => {
              const requestId = shown.pending?.requestId;
              if (requestId) {
                setAnswered((current) => ({ ...current, [requestId]: drafts }));
              }
              onDone(message, { runId: shown.runId });
            }}
          />
        ) : null}
      </section>
    </div>
  );
}
