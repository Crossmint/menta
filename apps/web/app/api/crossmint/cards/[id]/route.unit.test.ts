import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  prepareCards: vi.fn(),
  removeCard: vi.fn(),
  setDefaultCard: vi.fn(),
  setName: vi.fn(),
  setSetup: vi.fn(),
}));
vi.mock("../../../../../lib/server/user", () => ({
  currentUser: mocks.user,
  origin: () => "https://oca.example",
  sameOrigin: (r: Request) => r.headers.get("origin") === "https://oca.example",
  unauthorized: () => new Response(null, { status: 401 }),
}));
vi.mock("@oca/agent/crossmint", () => ({
  crossmintKey: () => "ck_test",
  prepareCardsForOrderIntents: mocks.prepareCards,
  removeCard: mocks.removeCard,
  setDefaultCard: mocks.setDefaultCard,
  getCardNames: () => ({ set: mocks.setName }),
  getCardSetups: () => ({ set: mocks.setSetup }),
}));

import { DELETE, PATCH } from "./route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (method: string, body?: unknown) =>
  new Request("https://oca.example/api/crossmint/cards/pm-1", {
    method,
    headers: { origin: "https://oca.example" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "verified-user", jwt: "jwt" });
  mocks.prepareCards.mockResolvedValue({
    cards: [{ paymentMethodId: "pm-1" }],
  });
  mocks.removeCard.mockResolvedValue(true);
  mocks.setDefaultCard.mockResolvedValue(true);
  mocks.setName.mockResolvedValue(undefined);
  mocks.setSetup.mockResolvedValue(undefined);
});

describe("PATCH /api/crossmint/cards/[id]", () => {
  it("names one of the user's own cards", async () => {
    const response = await PATCH(
      request("PATCH", { name: " Work " }),
      params("pm-1"),
    );
    expect(response.status).toBe(204);
    expect(mocks.setName).toHaveBeenCalledWith("verified-user", "pm-1", "Work");
  });

  it("names no card Crossmint doesn't list for the user", async () => {
    const response = await PATCH(
      request("PATCH", { name: "Work" }),
      params("pm-other"),
    );
    expect(response.status).toBe(404);
    expect(mocks.setName).not.toHaveBeenCalled();
  });

  it("remembers a card that pays with the encrypted card", async () => {
    const response = await PATCH(
      request("PATCH", { setup: "encrypted" }),
      params("pm-1"),
    );
    expect(response.status).toBe(204);
    expect(mocks.setSetup).toHaveBeenCalledWith(
      "verified-user",
      "pm-1",
      "encrypted",
    );
  });

  it("sets up no card Crossmint doesn't list for the user", async () => {
    const response = await PATCH(
      request("PATCH", { setup: "encrypted" }),
      params("pm-other"),
    );
    expect(response.status).toBe(404);
    expect(mocks.setSetup).not.toHaveBeenCalled();
  });

  it("refuses an unknown setup", async () => {
    const response = await PATCH(
      request("PATCH", { setup: "visa" }),
      params("pm-1"),
    );
    expect(response.status).toBe(400);
    expect(mocks.setSetup).not.toHaveBeenCalled();
  });

  it("refuses unknown fields", async () => {
    const response = await PATCH(
      request("PATCH", { name: "Work", userId: "someone-else" }),
      params("pm-1"),
    );
    expect(response.status).toBe(400);
    expect(mocks.setName).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/crossmint/cards/[id]", () => {
  it("clears the removed card's name", async () => {
    const response = await DELETE(request("DELETE"), params("pm-1"));
    expect(response.status).toBe(204);
    expect(mocks.setName).toHaveBeenCalledWith("verified-user", "pm-1", null);
  });

  it("keeps the name when Crossmint couldn't remove the card", async () => {
    mocks.removeCard.mockResolvedValue(false);
    const response = await DELETE(request("DELETE"), params("pm-1"));
    expect(response.status).toBe(502);
    expect(mocks.setName).not.toHaveBeenCalled();
  });
});
