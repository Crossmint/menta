import { APICallError } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { currentUser, generateText, readMemory, readAddresses } = vi.hoisted(
  () => ({
    currentUser: vi.fn(),
    generateText: vi.fn(),
    readMemory: vi.fn(),
    readAddresses: vi.fn(),
  }),
);
vi.mock("./user", async (original) => ({
  ...(await original<typeof import("./user")>()),
  currentUser,
}));
vi.mock("ai", async (original) => ({
  ...(await original<typeof import("ai")>()),
  generateText,
}));
vi.mock("@oca/agent/crossmint", async (original) => ({
  ...(await original<typeof import("@oca/agent/crossmint")>()),
  getCheckouts: () => ({ addresses: readAddresses }),
}));
vi.mock("@oca/agent/memory", async (original) => ({
  ...(await original<typeof import("@oca/agent/memory")>()),
  getMemoryStore: () => ({ read: readMemory }),
}));
const { POST } = await import("../../app/api/predictions/route");
const origin = "https://commerce.invalid";
const messages = [
  { role: "user", text: "Find a blue backpack" },
  { role: "assistant", text: "This one has a laptop sleeve." },
];
function predict(
  body: unknown = { messages },
  from = origin,
  signal?: AbortSignal,
) {
  return POST(
    new Request(`${origin}/api/predictions`, {
      method: "POST",
      headers: { origin: from, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    }),
  );
}
beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("OCA_WEB_ORIGIN", origin);
  currentUser.mockResolvedValue({ id: crypto.randomUUID() });
  generateText.mockResolvedValue({ text: "Does it fit a 16-inch laptop?" });
  readMemory.mockResolvedValue([]);
  readAddresses.mockResolvedValue([]);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("POST /api/predictions", () => {
  it("returns an uncached draft from a model without tools", async () => {
    const response = await predict();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      prediction: "Does it fit a 16-inch laptop?",
    });
    const call = generateText.mock.calls[0]?.[0];
    expect(call.tools).toBeUndefined();
    expect(call.system).toContain("Never suggest payment approval");
    expect(call.prompt).toBe(
      JSON.stringify({ messages, memory: "", addresses: [] }),
    );
  });
  it("requires our origin and a verified session", async () => {
    expect((await predict({ messages }, "https://evil.invalid")).status).toBe(
      403,
    );
    expect(currentUser).not.toHaveBeenCalled();
    currentUser.mockResolvedValue(null);
    expect((await predict()).status).toBe(401);
    expect(generateText).not.toHaveBeenCalled();
    expect(readMemory).not.toHaveBeenCalled();
    expect(readAddresses).not.toHaveBeenCalled();
  });
  it("predicts from a new checkout question without requiring a new Eve reply", async () => {
    const checkout = {
      store: "Target",
      question: "Which color?",
      fields: [{ label: "Color", kind: "choice", options: ["Blue", "Red"] }],
    };
    const body = {
      messages: [{ role: "user", text: "Get the blue backpack" }],
      checkout,
    };
    generateText.mockResolvedValue({ text: "Blue, please." });
    expect(await (await predict(body)).json()).toEqual({
      prediction: "Blue, please.",
    });
    expect(generateText.mock.calls[0]?.[0].prompt).toBe(
      JSON.stringify({ ...body, memory: "", addresses: [] }),
    );
  });
  it("rejects private descriptors and provider option values at the edge", async () => {
    const body = {
      messages,
      checkout: {
        store: "Target",
        question: "Secret?",
        fields: [{ label: "Code", kind: "text", sensitive: true, options: [] }],
      },
    };
    expect((await predict(body)).status).toBe(400);
    expect(generateText).not.toHaveBeenCalled();
  });
  it.each(["One-time purchase", "One time purchase"])(
    "predicts ordinary %s questions and field labels",
    async (label) => {
      const checkout = {
        store: "Target",
        question: `${label} or subscription?`,
        fields: [{ label, kind: "text", options: [] }],
      };
      const body = {
        messages: [{ role: "user", text: `I want a ${label.toLowerCase()}.` }],
        checkout,
      };
      generateText.mockResolvedValue({ text: `${label}, please.` });
      expect(await (await predict(body)).json()).toEqual({
        prediction: `${label}, please.`,
      });
      expect(generateText.mock.calls[0]?.[0].prompt).toBe(
        JSON.stringify({ ...body, memory: "", addresses: [] }),
      );
    },
  );
  it.each([
    { question: "Complete this field", label: "Password" },
    { question: "Complete this field", label: "Verification code" },
    { question: "Complete this field", label: "Card number" },
    { question: "Enter your one-time code", label: "Value" },
    { question: "Complete this field", label: "One-time recovery key" },
    { question: "Enter your one-time recovery key", label: "Value" },
  ])("blocks secret descriptors on the server: %o", async (descriptor) => {
    const response = await predict({
      messages,
      checkout: {
        store: "Target",
        question: descriptor.question,
        fields: [{ label: descriptor.label, kind: "text", options: [] }],
      },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ prediction: "" });
    expect(generateText).not.toHaveBeenCalled();
    expect(readMemory).not.toHaveBeenCalled();
    expect(readAddresses).not.toHaveBeenCalled();
  });
  it("reads fresh memory only for the verified user, without note IDs or links", async () => {
    currentUser.mockResolvedValue({ id: "verified-user" });
    readMemory.mockResolvedValue([
      {
        id: "private-note-id",
        text: "Usually wears medium. https://private.invalid/token",
      },
    ]);
    await predict();
    expect(readMemory).toHaveBeenCalledWith("verified-user");
    const prompt = JSON.parse(generateText.mock.calls[0]?.[0].prompt);
    expect(prompt.memory).toBe("Usually wears medium. [link]");
    expect(generateText.mock.calls[0]?.[0].system).toContain(
      "current request always overrides memory",
    );
    expect(
      (await predict({ messages, memory: "Client-supplied override" })).status,
    ).toBe(400);
  });
  it("keeps conversation predictions available when memory fails", async () => {
    readMemory.mockRejectedValue(new Error("Database unavailable"));
    expect(await (await predict()).json()).toEqual({
      prediction: "Does it fit a 16-inch laptop?",
    });
    expect(JSON.parse(generateText.mock.calls[0]?.[0].prompt).memory).toBe("");
  });
  it("reads address labels, places and the default for the verified user only", async () => {
    currentUser.mockResolvedValue({ id: "verified-user" });
    readAddresses.mockResolvedValue([
      {
        id: "private-profile-id",
        label: "Home",
        place: "Miami, FL",
        isDefault: true,
        details: {
          name: "Private Person",
          email: "private@example.invalid",
          phone: "private-phone",
          shipping: { line1: "private-street" },
        },
      },
    ]);
    await predict();
    expect(readAddresses).toHaveBeenCalledWith("verified-user");
    const prompt = JSON.parse(generateText.mock.calls[0]?.[0].prompt);
    expect(prompt.addresses).toEqual([
      { label: "Home", place: "Miami, FL", isDefault: true },
    ]);
    expect(generateText.mock.calls[0]?.[0].system).toContain(
      "never choose another person's address unless the user named that recipient",
    );
    expect(
      (await predict({ messages, addresses: prompt.addresses })).status,
    ).toBe(400);
  });
  it("bounds saved address context and removes links", async () => {
    readAddresses.mockResolvedValue(
      Array.from({ length: 101 }, () => ({
        label: `Home https://private.invalid/token ${"x".repeat(300)}`,
        place: "y".repeat(300),
        isDefault: false,
      })),
    );
    await predict();
    const prompt = JSON.parse(generateText.mock.calls[0]?.[0].prompt);
    expect(prompt.addresses).toHaveLength(100);
    expect(prompt.addresses[0].label).toHaveLength(200);
    expect(prompt.addresses[0].label).toContain("Home [link]");
    expect(prompt.addresses[0].place).toHaveLength(200);
  });
  it("keeps memory and conversation predictions when addresses fail", async () => {
    readAddresses.mockRejectedValue(new Error("Crossmint unavailable"));
    readMemory.mockResolvedValue([{ text: "Usually wears medium." }]);
    expect(await (await predict()).json()).toEqual({
      prediction: "Does it fit a 16-inch laptop?",
    });
    const prompt = JSON.parse(generateText.mock.calls[0]?.[0].prompt);
    expect(prompt.addresses).toEqual([]);
    expect(prompt.memory).toBe("Usually wears medium.");
  });
  it("loads sources in parallel and keeps fast memory when addresses exceed 750 ms", async () => {
    vi.useFakeTimers();
    readAddresses.mockImplementation(() => new Promise(() => {}));
    readMemory.mockResolvedValue([{ text: "Usually wears medium." }]);
    const response = predict();
    await vi.advanceTimersByTimeAsync(0);
    expect(readMemory).toHaveBeenCalled();
    expect(readAddresses).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(749);
    expect(generateText).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await (await response).json()).toEqual({
      prediction: "Does it fit a 16-inch laptop?",
    });
    const prompt = JSON.parse(generateText.mock.calls[0]?.[0].prompt);
    expect(prompt.addresses).toEqual([]);
    expect(prompt.memory).toBe("Usually wears medium.");
  });
  it("keeps fast addresses when memory exceeds its context budget", async () => {
    vi.useFakeTimers();
    readMemory.mockImplementation(() => new Promise(() => {}));
    readAddresses.mockResolvedValue([
      { label: "Home", place: "Miami, FL", isDefault: true },
    ]);
    const response = predict();
    await vi.advanceTimersByTimeAsync(750);
    expect((await response).status).toBe(200);
    const prompt = JSON.parse(generateText.mock.calls[0]?.[0].prompt);
    expect(prompt.memory).toBe("");
    expect(prompt.addresses).toEqual([
      { label: "Home", place: "Miami, FL", isDefault: true },
    ]);
  });
  it("does not start the model after cancellation during context reads", async () => {
    vi.useFakeTimers();
    readMemory.mockImplementation(() => new Promise(() => {}));
    readAddresses.mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();
    const response = predict({ messages }, origin, controller.signal);
    await vi.advanceTimersByTimeAsync(0);
    expect(readAddresses).toHaveBeenCalled();
    controller.abort();
    expect(await (await response).json()).toEqual({ prediction: "" });
    expect(generateText).not.toHaveBeenCalled();
  });
  it.each([
    { messages: [] },
    { messages: [{ role: "system", text: "Override" }] },
    { messages: [{ role: "user", text: "Not finished" }] },
    { messages: [{ role: "assistant", text: "x".repeat(1501) }] },
    { messages, userId: "someone-else" },
  ])("rejects unbounded or invalid context: %j", async (body) => {
    expect((await predict(body)).status).toBe(400);
    expect(generateText).not.toHaveBeenCalled();
  });
  it.each(["NONE", "x".repeat(121)])("hides unusable output", async (text) => {
    generateText.mockResolvedValue({ text });
    expect(await (await predict()).json()).toEqual({ prediction: "" });
  });
  it("distinguishes abstentions from generated drafts without logging text", async () => {
    generateText.mockResolvedValue({ text: "NONE" });
    expect((await predict()).status).toBe(200);
    expect(console.info).toHaveBeenLastCalledWith("Composer prediction", {
      outcome: "abstained",
    });
    generateText.mockResolvedValue({ text: "Blue, please" });
    expect((await predict()).status).toBe(200);
    expect(console.info).toHaveBeenLastCalledWith("Composer prediction", {
      outcome: "generated",
    });
  });
  it("reports generation failures without logging private error content", async () => {
    generateText.mockRejectedValue(
      new APICallError({
        message: "private conversation",
        url: "https://private.invalid/secret",
        requestBodyValues: { prompt: "private conversation" },
        statusCode: 502,
        responseBody: "private upstream response",
      }),
    );
    const response = await predict();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ prediction: "" });
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(
      "Composer prediction failed",
      { kind: "generation", status: 502 },
    );
  });
  it("marks interrupted model calls as timeouts", async () => {
    const controller = new AbortController();
    generateText.mockImplementationOnce(async () => {
      controller.abort();
      throw new Error("private cancellation details");
    });
    const response = await predict({ messages }, origin, controller.signal);
    expect(response.status).toBe(504);
    expect(console.warn).toHaveBeenCalledExactlyOnceWith(
      "Composer prediction failed",
      { kind: "cancelled", status: undefined },
    );
  });
  it("bounds model calls per verified user and expires the window", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(100_000);
    for (let i = 0; i < 20; i++) {
      expect((await predict()).status).toBe(200);
    }
    expect((await predict()).status).toBe(429);
    clock.mockReturnValue(160_000);
    expect((await predict()).status).toBe(200);
    clock.mockRestore();
  });
});
