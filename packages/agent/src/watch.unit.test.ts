import type { CheckoutView } from "@oca/crossmint-agent-checkouts/checkouts";
import type { SessionContext } from "eve/context";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  owner: vi.fn(),
  observe: vi.fn(),
  enabled: true,
}));
vi.mock("./crossmint.js", () => ({
  crossmintUserId: (auth: { subject?: string }) => auth?.subject ?? null,
  getCheckouts: () => ({ get: mocks.get }),
}));
vi.mock("./push.js", () => ({
  getCheckoutPush: () => (mocks.enabled ? { observe: mocks.observe } : null),
}));
vi.mock("./web/owners.js", () => ({
  getSessionOwners: () => ({ get: mocks.owner }),
}));

import { readCheckout } from "./watch.js";

const session = {
  id: "chat",
  auth: {
    current: {
      authenticator: "stytch",
      subject: "verified-user",
      issuer: "verified-issuer",
    },
  },
} as SessionContext["session"];
const view = {
  runId: "run",
  status: "awaiting_input",
  pending: { kind: "question", requestId: "request" },
} as CheckoutView;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled = true;
  mocks.get.mockResolvedValue(view);
  mocks.owner.mockResolvedValue({
    subject: "verified-user",
    issuer: "verified-issuer",
  });
  mocks.observe.mockResolvedValue(undefined);
});
it("uses the verified checkout owner and links delivery to that person's chat", async () => {
  expect(await readCheckout(session, "run")).toEqual({ view, settled: true });
  expect(mocks.get).toHaveBeenCalledWith("verified-user", "run");
  expect(mocks.observe).toHaveBeenCalledWith("verified-user", view, "chat");
});
it.each([
  null,
  { subject: "other", issuer: "verified-issuer" },
  { subject: "verified-user", issuer: "other" },
])("does not notify for deleted or differently owned chats", async (owner) => {
  mocks.owner.mockResolvedValue(owner);
  await readCheckout(session, "run");
  expect(mocks.observe).not.toHaveBeenCalled();
});
it("does no notification storage reads on a working checkout", async () => {
  mocks.get.mockResolvedValue({ ...view, status: "running", pending: null });
  await readCheckout(session, "run");
  expect(mocks.owner).not.toHaveBeenCalled();
  expect(mocks.observe).not.toHaveBeenCalled();
});
it("lets the agent continue if delivery fails, without logging the error's secrets", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.observe.mockRejectedValue(new Error("PRIVATE_ENDPOINT"));
  expect(await readCheckout(session, "run")).toEqual({ view, settled: true });
  expect(warn).toHaveBeenCalledWith("Notification delivery unavailable.");
  warn.mockRestore();
});
