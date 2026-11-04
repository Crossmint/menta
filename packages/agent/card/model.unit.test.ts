import { toView } from "@oca/crossmint-agent-checkouts/checkouts";
import { expect, describe as group, it } from "vitest";
import {
  CARD_DIAGNOSTIC_REASONS,
  OBSERVED_AT as serverObservedAt,
  PROGRESS as serverProgress,
} from "../src/mcp/card.js";
import { present } from "../src/mcp/moments.js";
import {
  answerSummary,
  answers,
  asksForAddress,
  asksWhichAddress,
  assistantOnly,
  autoFullscreen,
  type Checkout,
  DIAGNOSTIC_REASONS,
  describe,
  type Field,
  hostModes,
  modeOffers,
  OBSERVED_AT,
  onMobile,
  outcomeLine,
  PROGRESS,
  parseProgress,
  parseResult,
  progressLine,
  refreshedContext,
  STALL_MS,
  safeActionUrl,
  safeArea,
  stallReason,
} from "./model.js";

const origin = "https://commerce.invalid";
const actionUrl = (runId: string) => `${origin}/checkouts/${runId}`;

function run(status: string, extra: Record<string, unknown> = {}) {
  return {
    runId: "run-1",
    revision: 1,
    status,
    createdAt: "2026-10-05T12:00:00.000Z",
    input: {
      request: { startUrl: "https://www.store.invalid/item", task: "One mug" },
      constraints: { maxCost: { amount: "40.00", currency: "USD" } },
    },
    browser: { embedUrl: "https://live.invalid/LIVE_VIEW_CANARY" },
    ...extra,
  };
}

function awaiting(interaction: Record<string, unknown>) {
  return run("awaiting_input", {
    requiredAction: {
      requestId: "req-1",
      request: { question: "Which one?", expiresAt: null, interaction },
    },
  });
}

/** What the card receives: the real server's tool result for a Crossmint run. */
function served(raw: unknown) {
  // biome-ignore lint/suspicious/noExplicitAny: fixtures stand in for Crossmint's DTO
  return present(toView(raw as any, actionUrl));
}

const size: Field = {
  key: "size",
  label: "Size",
  required: true,
  kind: "choice",
  multiple: false,
  options: [
    { value: "s", label: "Small" },
    { value: "m", label: "Medium" },
  ],
  placeholder: null,
};

group("checkout card model", () => {
  it("shares the observedAt key with the server", () => {
    expect(OBSERVED_AT).toBe(serverObservedAt);
  });

  it("reads the server's result and never carries the live view", () => {
    const parsed = parseResult(
      JSON.parse(
        JSON.stringify(
          served(
            awaiting({
              kind: "payment",
              amount: { kind: "exact", value: "31.20", currency: "USD" },
              merchant: {
                name: "Store",
                url: "https://store.invalid",
                countryCode: "US",
              },
            }),
          ),
        ),
      ),
      origin,
    );
    expect(parsed?.checkout).toMatchObject({
      runId: "run-1",
      status: "awaiting_input",
      store: "store.invalid",
      task: "One mug",
      maxCost: { amount: "40.00", currency: "USD" },
      pending: {
        kind: "payment",
        amount: { amount: "31.20", currency: "USD", exact: true },
        merchant: "Store",
        actionUrl: `${origin}/checkouts/run-1`,
      },
    });
    expect(parsed?.observedAt).toBeGreaterThan(0);
    expect(parsed?.next).toContain("pending.actionUrl");
    expect(JSON.stringify(parsed)).not.toContain("CANARY");
    expect(describe(parsed?.checkout as never)).toEqual({
      tone: "attention",
      label: "Needs you",
    });
  });

  it("ignores a live view URL even if a result carried one", () => {
    const result = served(run("running"));
    const leaky = {
      ...result,
      structuredContent: {
        ...result.structuredContent,
        checkout: {
          ...(result.structuredContent.checkout as object),
          liveViewUrl: "https://live.invalid/LIVE_VIEW_CANARY",
        },
      },
    };
    expect(JSON.stringify(parseResult(leaky, origin))).not.toContain("CANARY");
  });

  it.each([
    ["another origin", "https://evil.invalid/checkouts/run-1"],
    ["another path", `${origin}/account`],
    ["another run", `${origin}/checkouts/run-2`],
    ["a script URL", "javascript:alert(1)"],
    ["credentials", "https://user:pass@commerce.invalid/checkouts/run-1"],
  ])("rejects a secure link to %s", (_label, url) => {
    expect(safeActionUrl(url, origin, "run-1")).toBeNull();
    const result = served(
      awaiting({
        kind: "form",
        fields: [
          {
            key: "code",
            label: "Code",
            required: true,
            handling: "protected",
            input: { kind: "text" },
          },
        ],
      }),
    );
    const tampered = structuredClone(result) as unknown as {
      structuredContent: { checkout: { pending: { actionUrl: string } } };
    };
    tampered.structuredContent.checkout.pending.actionUrl = url;
    expect(parseResult(tampered, origin)).toBeNull();
    expect(parseResult(result, origin)?.checkout.pending).toMatchObject({
      kind: "protected",
      actionUrl: `${origin}/checkouts/run-1`,
    });
  });

  it.each([
    ["chatgpt", "chatgpt"],
    ["claude", "claude"],
    ["local", null],
    [null, null],
  ] as const)("tags the secure link for host %s", (host, via) => {
    const payment = awaiting({
      kind: "payment",
      amount: { kind: "exact", value: "31.20", currency: "USD" },
      merchant: {
        name: "Store",
        url: "https://store.invalid",
        countryCode: "US",
      },
    });
    // biome-ignore lint/suspicious/noExplicitAny: fixtures stand in for Crossmint's DTO
    const result = present(toView(payment as any, actionUrl), { via: host });
    const link = parseResult(result, origin)?.checkout.pending;
    const expected = `${origin}/checkouts/run-1${via ? `?via=${via}` : ""}`;
    expect(link).toMatchObject({ kind: "payment", actionUrl: expected });
    expect(safeActionUrl(expected, origin, "run-1")).toBe(expected);
  });

  it("takes a payment's spending limit request link, and only a payment's", () => {
    const request = `${origin}/spending-limit/sealed-Token_1`;
    const payment = awaiting({
      kind: "payment",
      amount: { kind: "exact", value: "31.20", currency: "USD" },
      merchant: {
        name: "Store",
        url: "https://store.invalid",
        countryCode: "US",
      },
    });
    // biome-ignore lint/suspicious/noExplicitAny: fixtures stand in for Crossmint's DTO
    const result = present(toView(payment as any, () => request));
    expect(parseResult(result, origin)?.checkout.pending).toMatchObject({
      kind: "payment",
      actionUrl: request,
    });
    expect(safeActionUrl(request, origin, "run-1", true)).toBe(request);
    expect(safeActionUrl(request, origin, "run-1")).toBeNull();
    expect(
      safeActionUrl(
        `${request}?next=https://evil.invalid`,
        origin,
        "run-1",
        true,
      ),
    ).toBeNull();
    expect(
      safeActionUrl(
        "https://evil.invalid/spending-limit/sealed",
        origin,
        "run-1",
        true,
      ),
    ).toBeNull();
  });

  it("rejects errors and malformed results", () => {
    expect(parseResult({ isError: true, content: [] }, origin)).toBeNull();
    expect(parseResult({ structuredContent: {} }, origin)).toBeNull();
    expect(
      parseResult(
        { structuredContent: { checkout: { runId: "x", status: "weird" } } },
        origin,
      ),
    ).toBeNull();
  });

  it("reads choice questions with labels as given", () => {
    const parsed = parseResult(
      served(
        awaiting({
          kind: "form",
          fields: [
            {
              key: "size",
              label: "Size",
              required: true,
              handling: "standard",
              input: {
                kind: "choice",
                selection: { kind: "one" },
                options: [
                  { value: "s", label: "Small <b>" },
                  { value: "m", label: "Medium" },
                  { value: "x", label: "Sold out", disabled: true },
                ],
              },
            },
          ],
        }),
      ),
      origin,
    );
    expect(parsed?.checkout.pending).toMatchObject({
      kind: "question",
      question: "Which one?",
      fields: [
        {
          key: "size",
          kind: "choice",
          multiple: false,
          options: [
            { value: "s", label: "Small <b>" },
            { value: "m", label: "Medium" },
          ],
        },
      ],
    });
  });

  it("builds answers only from allowed values", () => {
    expect(answers([size], { size: "m" })).toEqual({ size: "m" });
    expect(answers([size], { size: "xl" })).toBeNull();
    expect(answers([size], {})).toBeNull();
    const fields: Field[] = [
      { ...size, key: "qty", label: "Quantity", kind: "integer", options: [] },
      { ...size, key: "gift", label: "Gift", kind: "boolean", options: [] },
      {
        ...size,
        key: "note",
        label: "Note",
        kind: "text",
        required: false,
        options: [],
      },
      { ...size, key: "extras", label: "Extras", multiple: true },
    ];
    expect(
      answers(fields, { qty: "2", gift: false, note: "", extras: ["s"] }),
    ).toEqual({ qty: 2, gift: false, extras: ["s"] });
    expect(answers(fields, { qty: "2.5", gift: true, extras: ["s"] })).toBe(
      null,
    );
    expect(answerSummary([size], { size: "m" })).toBe("Medium");
  });

  it("describes outcomes like the web card", () => {
    const succeeded = parseResult(
      served(
        run("succeeded", {
          result: {
            summary: "Done",
            purchase: {
              kind: "receipt_captured",
              receipt: {
                total: { amount: "31.20", currency: "USD" },
                merchantOrderId: "SO-1",
              },
            },
          },
        }),
      ),
      origin,
    );
    expect(succeeded?.checkout.result?.receipt).toEqual({
      total: { amount: "31.20", currency: "USD" },
      merchantOrderId: "SO-1",
    });
    expect(describe(succeeded?.checkout as never).label).toBe("Order placed");
    const unsure = parseResult(
      served(
        run("blocked", {
          result: { summary: "Unclear", code: "reconciliation_required" },
        }),
      ),
      origin,
    );
    expect(describe(unsure?.checkout as never)).toEqual({
      tone: "idle",
      label: "Not confirmed",
    });
  });

  it("tells the model the latest state without the live view", () => {
    const parsed = parseResult(served(run("running")), origin);
    const text = refreshedContext(parsed as never);
    expect(text).toContain("run-1");
    expect(text).toContain("Call continue with this runId");
    expect(text).not.toContain("CANARY");
  });

  it("reads progress from _meta and keeps it out of the model's context", () => {
    expect(PROGRESS).toBe(serverProgress);
    const view = toView(run("running") as never, actionUrl);
    const parsed = parseResult(
      JSON.parse(
        JSON.stringify(
          present({
            ...view,
            progress: {
              now: {
                text: "Adding the mug to the cart",
                status: "running",
                at: "2026-10-05T12:00:05.000Z",
              },
              recent: [],
            },
          }),
        ),
      ),
      origin,
    );
    expect(parsed?.progress).toEqual({
      now: {
        text: "Adding the mug to the cart",
        running: true,
        at: Date.parse("2026-10-05T12:00:05.000Z"),
      },
    });
    const context = refreshedContext(parsed as never);
    expect(context).not.toContain("Adding the mug");
    // Results without progress (or a reader that failed) parse without it.
    expect(parseResult(served(run("running")), origin)?.progress).toBeNull();
  });

  it("drops malformed progress parts instead of failing", () => {
    expect(parseProgress("nope")).toBeNull();
    expect(
      parseProgress({
        now: { text: "x".repeat(241), status: "running", at: "2026-10-05" },
      }),
    ).toEqual({ now: null });
    expect(
      parseProgress({
        now: { text: "Paying", status: "completed", at: "not a time" },
      }),
    ).toEqual({ now: null });
  });

  it("says Still working once the newest step is old", () => {
    const at = Date.parse("2026-10-05T12:00:00.000Z");
    const progress = {
      now: { text: "Choosing a size", running: false, at },
    };
    expect(progressLine(progress, at + 60_000)).toEqual({
      text: "Choosing a size",
      running: false,
    });
    expect(progressLine(progress, at + 91_000)).toEqual({
      text: "Still working…",
      running: true,
    });
    // Waiting on the user, the last step stands.
    expect(progressLine(progress, at + 91_000, true)?.text).toBe(
      "Choosing a size",
    );
    expect(progressLine(null, at)).toBeNull();
  });

  it("knows which saved address the run ships to", () => {
    const withAddress = run("running", {
      input: { ...run("running").input, buyerProfileId: "profile-1" },
    });
    const parsed = parseResult(
      present(
        // biome-ignore lint/suspicious/noExplicitAny: fixtures stand in for Crossmint's DTO
        toView(withAddress as any, actionUrl, {
          label: "Home",
          place: "Miami, FL",
        }),
      ),
      origin,
    );
    expect(parsed?.checkout.shipsTo).toEqual({
      label: "Home",
      place: "Miami, FL",
    });
    expect(
      parseResult(served(run("running")), origin)?.checkout.shipsTo,
    ).toBeNull();
  });
});

group("addresses in the card", () => {
  it("points at the chat when a start stops for an address", () => {
    const which = {
      structuredContent: {
        whichAddress: {
          requested: "Sarah",
          options: [{ label: "Sarah Lee", place: "Austin, TX" }],
        },
        next: "Ask the user…",
      },
    };
    const needed = {
      structuredContent: {
        addressNeeded: { label: "Mom", cityHint: "Tampa" },
        next: "Ask the user…",
      },
    };
    expect(asksWhichAddress(which)).toBe(true);
    expect(asksForAddress(which)).toBe(false);
    expect(asksForAddress(needed)).toBe(true);
    expect(asksWhichAddress(needed)).toBe(false);
    expect(parseResult(which, origin)).toBeNull();
    expect(parseResult(needed, origin)).toBeNull();
  });
});

group("display modes", () => {
  const situation = {
    current: "inline" as const,
    active: true,
    frozen: false,
  };

  it("offers nothing when the host lists only inline", () => {
    expect(modeOffers({ ...situation, available: ["inline"] })).toEqual({
      expand: false,
      pip: false,
      back: false,
    });
  });

  it("offers Expand where the host lists fullscreen (ChatGPT, Claude)", () => {
    expect(
      modeOffers({ ...situation, available: ["inline", "fullscreen"] }),
    ).toEqual({ expand: true, pip: false, back: false });
  });

  it("offers Keep visible only where the host lists pip", () => {
    expect(modeOffers({ ...situation, available: ["inline", "pip"] })).toEqual({
      expand: false,
      pip: true,
      back: false,
    });
  });

  it("offers the way back out of fullscreen or pip, and nothing else", () => {
    for (const current of ["fullscreen", "pip"] as const) {
      expect(
        modeOffers({
          ...situation,
          current,
          available: ["inline", "fullscreen", "pip"],
        }),
      ).toEqual({ expand: false, pip: false, back: true });
    }
  });

  it("offers nothing for an ended checkout or a superseded card", () => {
    const available = ["inline", "fullscreen", "pip"] as const;
    for (const change of [{ active: false }, { frozen: true }]) {
      expect(
        modeOffers({ ...situation, available: [...available], ...change }),
      ).toEqual({ expand: false, pip: false, back: false });
    }
  });

  it("takes the host's list, and assumes no pip from ChatGPT's own API", () => {
    expect(hostModes(["inline", "pip", "bogus"], true)).toEqual([
      "inline",
      "pip",
    ]);
    expect(hostModes(undefined, true)).toEqual(["inline", "fullscreen"]);
    expect(hostModes(undefined, false)).toEqual([]);
  });

  it("never offers pip on ChatGPT, even when it lists it", () => {
    const modes = hostModes(["inline", "fullscreen", "pip"], true, true);
    expect(modes).toEqual(["inline", "fullscreen"]);
    expect(modeOffers({ ...situation, available: modes }).pip).toBe(false);
  });

  it("expands the secure step by itself only on a phone, once per request", () => {
    const base = {
      available: ["inline", "fullscreen"] as ("inline" | "fullscreen")[],
      current: "inline" as const,
      mobile: true,
      alreadyFor: null,
      requestId: "req-pay",
    };
    expect(autoFullscreen(base)).toBe(true);
    expect(autoFullscreen({ ...base, mobile: false })).toBe(false);
    expect(autoFullscreen({ ...base, alreadyFor: "req-pay" })).toBe(false);
    expect(autoFullscreen({ ...base, available: ["inline"] })).toBe(false);
    expect(autoFullscreen({ ...base, current: "fullscreen" })).toBe(false);
  });

  it("knows a phone from the host context or ChatGPT's user agent", () => {
    expect(onMobile("mobile", undefined)).toBe(true);
    expect(onMobile("web", { device: { type: "mobile" } })).toBe(true);
    expect(onMobile("desktop", { device: { type: "desktop" } })).toBe(false);
    expect(onMobile(undefined, "mobile")).toBe(false);
  });

  it("reads safe-area insets as clamped pixel lengths", () => {
    expect(safeArea({ top: 47, right: 0, bottom: 34.4, left: "x" })).toEqual({
      top: "47px",
      right: "0px",
      bottom: "34px",
      left: "0px",
    });
    expect(safeArea({ top: -3, bottom: 9999 })).toMatchObject({
      top: "0px",
      bottom: "200px",
    });
    expect(safeArea(null)).toEqual({
      top: "0px",
      right: "0px",
      bottom: "0px",
      left: "0px",
    });
  });

  it("marks model notes for the assistant only", () => {
    expect(assistantOnly("note")).toEqual({
      type: "text",
      text: "note",
      annotations: { audience: ["assistant"] },
    });
  });
});

group("live updates", () => {
  it("names why an active checkout went unread", () => {
    const base = {
      active: true,
      sinceRead: STALL_MS,
      frozen: false,
      paused: false,
      hidden: false,
    };
    expect(stallReason(base)).toBe("stalled-unknown");
    expect(stallReason({ ...base, hidden: true })).toBe("stalled-hidden");
    expect(stallReason({ ...base, paused: true })).toBe("stalled-paused");
    expect(stallReason({ ...base, frozen: true })).toBe("stalled-frozen");
    expect(stallReason({ ...base, sinceRead: STALL_MS - 1 })).toBeNull();
    expect(stallReason({ ...base, active: false })).toBeNull();
  });

  it("reports only reasons the server accepts", () => {
    expect([...DIAGNOSTIC_REASONS]).toEqual([...CARD_DIAGNOSTIC_REASONS]);
  });
});

group("live view", () => {
  it("never reads a live-view URL out of a checkout result", () => {
    const snapshot = parseResult(served(run("running")), origin);
    expect(JSON.stringify(snapshot)).not.toContain("LIVE_VIEW_CANARY");
  });
});

group("CARD outcome line for a cancelled checkout", () => {
  const cancelled = (summary?: string) =>
    ({
      status: "cancelled",
      ...(summary ? { result: { summary } } : {}),
    }) as unknown as Checkout;

  it("skips Crossmint's generic summary, which only repeats the label", () => {
    expect(outcomeLine(cancelled("The checkout was canceled."))).toBeNull();
    expect(outcomeLine(cancelled())).toBeNull();
  });

  it("keeps a summary that says something", () => {
    expect(outcomeLine(cancelled("Cancelled: the store was closed."))).toBe(
      "“Cancelled: the store was closed.”",
    );
  });
});
