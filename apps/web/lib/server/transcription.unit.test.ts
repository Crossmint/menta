import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getToken = vi.hoisted(() => vi.fn());
const currentUser = vi.hoisted(() => vi.fn());

vi.mock("ai", () => ({
  gateway: { experimental_transcription: { getToken } },
}));
vi.mock("./user", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./user")>()),
  currentUser,
}));

const { POST } = await import("../../app/api/transcription/route");
const { allowDictation, resetDictationLimits, transcriptionModel } =
  await import("./transcription");

const origin = "https://commerce.invalid";

function start(headers: Record<string, string> = { origin }) {
  return POST(
    new Request(`${origin}/api/transcription`, { method: "POST", headers }),
  );
}

beforeEach(() => {
  vi.stubEnv("OCA_WEB_ORIGIN", origin);
  resetDictationLimits();
  currentUser.mockResolvedValue({ id: "user-test-1" });
  getToken.mockResolvedValue({
    token: "vcst_test",
    url: "wss://gateway.invalid",
    expiresAt: 1_900_000_000,
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("POST /api/transcription", () => {
  it("mints a short-lived secret for the fixed model", async () => {
    const response = await start();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      token: "vcst_test",
      model: transcriptionModel,
      expiresAt: 1_900_000_000,
      maxSeconds: 120,
    });
    expect(getToken).toHaveBeenCalledWith({
      model: transcriptionModel,
      expiresAfterSeconds: 60,
    });
  });

  it("requires a signed-in user", async () => {
    currentUser.mockResolvedValue(null);
    const response = await start();
    expect(response.status).toBe(401);
    expect(getToken).not.toHaveBeenCalled();
  });

  it.each([
    ["no origin", {}],
    ["another origin", { origin: "https://evil.invalid" }],
  ])("refuses requests with %s", async (_, headers) => {
    const response = await start(headers);
    expect(response.status).toBe(403);
    expect(currentUser).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
  });

  it("limits how many dictations a user starts", async () => {
    for (let i = 0; i < 30; i++) {
      expect((await start()).status).toBe(200);
    }
    const limited = await start();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(getToken).toHaveBeenCalledTimes(30);

    currentUser.mockResolvedValue({ id: "user-test-2" });
    expect((await start()).status).toBe(200);
  });

  it("hides provider failures", async () => {
    getToken.mockRejectedValue(new Error("PROVIDER_BODY_CANARY"));
    const response = await start();
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("CANARY");
  });
});

describe("allowDictation", () => {
  it("frees up as the window passes", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 30; i++) {
      expect(allowDictation("u", t0 + i)).toBe(true);
    }
    expect(allowDictation("u", t0 + 60_000)).toBe(false);
    expect(allowDictation("u", t0 + 10 * 60_000 + 1)).toBe(true);
  });
});
