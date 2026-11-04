import type { CheckoutView } from "@oca/crossmint-agent-checkouts/checkouts";
import type { EveMessage } from "eve/react";
import { describe, expect, it } from "vitest";
import { predictionContext, predictionQuestion } from "./predictions";

describe("prediction context", () => {
  it("keeps visible text without tool results, photos, or capability URLs", () => {
    const messages = [
      {
        id: "reply",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "See [checkout](https://commerce.invalid/checkouts/secret) or https://uc.crossmint.com/runs/private/browser-embed",
          },
          {
            type: "dynamic-tool",
            toolName: "checkouts__get",
            state: "output-available",
            output: { liveUrl: "private", protectedInputId: "secret" },
          },
          { type: "file", url: "data:image/jpeg;base64,private" },
        ],
      },
    ] as unknown as EveMessage[];
    expect(predictionContext(messages)).toEqual([
      { role: "assistant", text: "See checkout or [link]" },
    ]);
  });

  it("omits dock notes, including ordinary form answers", () => {
    const messages = [
      {
        id: "note",
        role: "user",
        parts: [
          {
            type: "text",
            text: "Approved the payment in the checkout panel (checkout run-1 at Target).",
          },
        ],
      },
    ] as EveMessage[];
    expect(predictionContext(messages)).toEqual([]);
  });

  it("bounds context to the six latest messages and 1500 characters each", () => {
    const messages = Array.from({ length: 10 }, (_, index) => ({
      id: String(index),
      role: "assistant",
      parts: [{ type: "text", text: `${index}${"a".repeat(1600)}` }],
    })) as EveMessage[];
    const context = predictionContext(messages);
    expect(context).toHaveLength(6);
    expect(context.every((message) => message.text.length === 1500)).toBe(true);
  });
  it("retains the latest user request after more than six agent updates", () => {
    const messages = [
      {
        id: "user",
        role: "user",
        parts: [{ type: "text", text: "Find a blue backpack under $80" }],
      },
      ...Array.from({ length: 10 }, (_, index) => ({
        id: String(index),
        role: "assistant",
        parts: [{ type: "text", text: `Update ${index}` }],
      })),
    ] as EveMessage[];
    expect(predictionContext(messages)).toEqual([
      { role: "user", text: "Find a blue backpack under $80" },
      ...[5, 6, 7, 8, 9].map((index) => ({
        role: "assistant",
        text: `Update ${index}`,
      })),
    ]);
  });
  it("keeps the current request rather than an earlier shopping goal", () => {
    const messages = [
      {
        id: "old",
        role: "user",
        parts: [{ type: "text", text: "Find a backpack" }],
      },
      {
        id: "new",
        role: "user",
        parts: [{ type: "text", text: "Actually get horchata ingredients" }],
      },
      ...Array.from({ length: 8 }, (_, index) => ({
        id: String(index),
        role: "assistant",
        parts: [{ type: "text", text: `Update ${index}` }],
      })),
    ] as EveMessage[];
    expect(predictionContext(messages)[0]).toEqual({
      role: "user",
      text: "Actually get horchata ingredients",
    });
    expect(JSON.stringify(predictionContext(messages))).not.toContain(
      "backpack",
    );
  });
  it("excludes dock notes while looking back for the user's request", () => {
    const messages = [
      {
        id: "user",
        role: "user",
        parts: [{ type: "text", text: "Get this rain jacket" }],
      },
      {
        id: "note",
        role: "user",
        parts: [
          {
            type: "text",
            text: "Approved the payment in the checkout panel (checkout run-1 at Target).",
          },
        ],
      },
      ...Array.from({ length: 8 }, (_, index) => ({
        id: String(index),
        role: "assistant",
        parts: [{ type: "text", text: `Update ${index}` }],
      })),
    ] as EveMessage[];
    const context = predictionContext(messages);
    expect(context).toHaveLength(6);
    expect(context[0]).toEqual({ role: "user", text: "Get this rain jacket" });
    expect(JSON.stringify(context)).not.toContain("Approved");
  });
  it.each([
    {
      parts: [
        {
          type: "file",
          url: "data:image/jpeg;base64,private",
          mediaType: "image/jpeg",
        },
      ],
    },
    { parts: [{ type: "text", text: "[file: raincoat.jpg]" }] },
  ])(
    "does not revive an older goal past a photo-only request: %j",
    ({ parts }) => {
      const messages = [
        {
          id: "old",
          role: "user",
          parts: [{ type: "text", text: "Find a blue backpack under $80" }],
        },
        { id: "photo", role: "user", parts },
        ...Array.from({ length: 8 }, (_, index) => ({
          id: String(index),
          role: "assistant",
          parts: [{ type: "text", text: `Raincoat update ${index}` }],
        })),
      ] as EveMessage[];
      const context = predictionContext(messages);
      expect(context).toHaveLength(6);
      expect(context.every((message) => message.role === "assistant")).toBe(
        true,
      );
      expect(JSON.stringify(context)).not.toMatch(
        /backpack|80|private|raincoat\.jpg/,
      );
    },
  );
  it("does not parse older assistant payloads while looking back for a user request", () => {
    let reads = 0;
    const messages = Array.from({ length: 10_000 }, (_, index) => ({
      id: String(index),
      role: "assistant",
      get parts() {
        reads++;
        return [{ type: "text", text: `Reply ${index}` }];
      },
    })) as EveMessage[];
    expect(predictionContext(messages).map((message) => message.text)).toEqual(
      [9994, 9995, 9996, 9997, 9998, 9999].map((index) => `Reply ${index}`),
    );
    expect(reads).toBe(6);
  });
});

describe("checkout prediction context", () => {
  const run = {
    runId: "run-private",
    status: "awaiting_input",
    store: "Target",
    liveViewUrl: "https://uc.crossmint.com/private",
    progress: { latest: "private progress" },
    pending: {
      kind: "question",
      requestId: "request-private",
      question: "Which color?",
      fields: [
        {
          key: "internal-key",
          kind: "choice",
          label: "Color",
          required: true,
          options: [
            {
              value: "internal-value",
              label: "Blue",
              image: "https://private.invalid",
            },
          ],
        },
      ],
    },
  } as unknown as CheckoutView;

  it("uses the question and displayed choices without provider IDs or capabilities", () => {
    expect(predictionQuestion(run)).toEqual({
      store: "Target",
      question: "Which color?",
      fields: [{ label: "Color", kind: "choice", options: ["Blue"] }],
    });
    expect(JSON.stringify(predictionQuestion(run))).not.toContain("private");
  });
  it.each(["One-time purchase", "One time purchase"])(
    "keeps ordinary %s questions and field labels available",
    (label) => {
      if (run.pending?.kind !== "question") {
        throw new Error("Expected an ordinary question fixture");
      }
      const question = `${label} or subscription?`;
      expect(
        predictionQuestion({
          ...run,
          pending: {
            ...run.pending,
            question,
            fields: [{ key: "input", label, kind: "text", required: true }],
          },
        }),
      ).toEqual({
        store: "Target",
        question,
        fields: [{ label, kind: "text", options: [] }],
      });
    },
  );
  it.each([
    "Password",
    "Verification code",
    "CVV",
    "PIN",
    "One-time code",
    "One-time recovery key",
    "Recovery key",
    "One-time authentication code",
  ])("excludes an unmasked %s field without a sensitive flag", (label) => {
    if (run.pending?.kind !== "question") {
      throw new Error("Expected an ordinary question fixture");
    }
    expect(
      predictionQuestion({
        ...run,
        pending: {
          ...run.pending,
          fields: [{ key: "input", label, kind: "text", required: true }],
        },
      }),
    ).toBeNull();
  });
  it("excludes a secret question even with an innocuous field label", () => {
    if (run.pending?.kind !== "question") {
      throw new Error("Expected an ordinary question fixture");
    }
    expect(
      predictionQuestion({
        ...run,
        pending: { ...run.pending, question: "Enter your verification code" },
      }),
    ).toBeNull();
  });
  it("excludes payment, protected, and sensitive ordinary requests", () => {
    for (const kind of ["payment", "protected"] as const) {
      expect(
        predictionQuestion({
          ...run,
          pending: { ...run.pending, kind },
        } as CheckoutView),
      ).toBeNull();
    }
    if (run.pending?.kind === "question") {
      expect(
        predictionQuestion({
          ...run,
          pending: {
            ...run.pending,
            fields: [
              {
                key: "code",
                label: "Code",
                kind: "text",
                required: true,
                sensitive: true,
              },
            ],
          },
        }),
      ).toBeNull();
    }
    expect(predictionQuestion({ ...run, status: "running" })).toBeNull();
  });
});
