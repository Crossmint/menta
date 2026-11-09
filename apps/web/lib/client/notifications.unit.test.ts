import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  disableNotifications,
  enableNotifications,
  notificationState,
  syncNotificationUser,
} from "./notifications";

const publicKey = Buffer.from([4, ...Array(64).fill(7)]).toString("base64url");
const values = new Map<string, string>();
const unsubscribe = vi.fn(async () => true);
const subscription = {
  endpoint: "https://fcm.googleapis.com/fake",
  unsubscribe,
  options: { applicationServerKey: Buffer.from(publicKey, "base64url").buffer },
  toJSON() {
    return { endpoint: this.endpoint, keys: {} };
  },
};
const getSubscription = vi.fn(async () => subscription);
const subscribe = vi.fn(async () => subscription);
const register = vi.fn(async () => ({
  pushManager: { getSubscription, subscribe },
}));
const permission = vi.fn(async () => "granted");
const fetchMock = vi.fn(async () => Response.json({ id: "device" }));

beforeEach(() => {
  vi.clearAllMocks();
  values.clear();
  subscription.endpoint = "https://fcm.googleapis.com/fake";
  getSubscription.mockResolvedValue(subscription);
  unsubscribe.mockResolvedValue(true);
  permission.mockResolvedValue("granted");
  fetchMock.mockResolvedValue(Response.json({ id: "device" }));
  const key = Uint8Array.from(Buffer.from(publicKey, "base64url"));
  subscription.options.applicationServerKey = key.buffer;
  vi.stubGlobal("window", {
    isSecureContext: true,
    Notification: {},
    PushManager: {},
  });
  vi.stubGlobal("Notification", {
    requestPermission: permission,
    permission: "granted",
  });
  vi.stubGlobal("navigator", {
    serviceWorker: {
      register,
      ready: Promise.resolve(),
      getRegistration: async () => ({ pushManager: { getSubscription } }),
    },
  });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
function saved(userId = "owner") {
  values.set(
    "oca-notifications",
    JSON.stringify({
      userId,
      id: "device",
      endpointHash: createHash("sha256")
        .update(subscription.endpoint)
        .digest("hex"),
    }),
  );
}

describe("browser notification ownership and permission", () => {
  it("requests permission synchronously from the click, before registration or network", async () => {
    const pending = enableNotifications("owner", publicKey);
    expect(permission).toHaveBeenCalledOnce();
    expect(register).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    await pending;
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    });
    expect(JSON.parse(values.get("oca-notifications") ?? "null")).toEqual({
      userId: "owner",
      id: "device",
      endpointHash: createHash("sha256")
        .update(subscription.endpoint)
        .digest("hex"),
    });
  });
  it("stops after denied permission", async () => {
    permission.mockResolvedValue("denied");
    expect(await enableNotifications("owner", publicKey)).toBe(false);
    expect(register).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("leaves a dismissed prompt unenrolled and allows an explicit retry", async () => {
    permission.mockResolvedValueOnce("default");
    expect(await enableNotifications("owner", publicKey)).toBe(false);
    expect(register).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await enableNotifications("owner", publicKey)).toBe(true);
    expect(permission).toHaveBeenCalledTimes(2);
    expect(subscribe).toHaveBeenCalledOnce();
  });
  it("does not ask again or enroll while browser permissions are blocked", async () => {
    vi.stubGlobal("Notification", {
      permission: "denied",
      requestPermission: permission,
    });
    expect(await enableNotifications("owner", publicKey)).toBe(false);
    expect(permission).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("never prompts while reading settings; mismatched owners do not supply a device ID", async () => {
    saved("other");
    fetchMock.mockResolvedValue(
      Response.json({ available: true, publicKey, subscribed: false }),
    );
    expect((await notificationState("owner")).enabled).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith("/api/notifications", {
      cache: "no-store",
    });
    expect(permission).not.toHaveBeenCalled();
  });
  it("recognizes an enabled device and forces re-enrollment after key rotation", async () => {
    saved();
    fetchMock.mockResolvedValue(
      Response.json({
        available: true,
        publicKey,
        subscribed: true,
        id: "device",
        endpointHash: createHash("sha256")
          .update(subscription.endpoint)
          .digest("hex"),
      }),
    );
    expect((await notificationState("owner")).enabled).toBe(true);
    subscription.options.applicationServerKey = new Uint8Array([1]).buffer;
    fetchMock.mockResolvedValue(
      Response.json({
        available: true,
        publicKey,
        subscribed: true,
        id: "device",
        endpointHash: createHash("sha256")
          .update(subscription.endpoint)
          .digest("hex"),
      }),
    );
    expect((await notificationState("owner")).enabled).toBe(false);
  });
  it("refreshes a renewed endpoint and updates the saved enrollment", async () => {
    saved();
    const oldHash = createHash("sha256")
      .update(subscription.endpoint)
      .digest("hex");
    subscription.endpoint = "https://fcm.googleapis.com/renewed";
    fetchMock
      .mockResolvedValueOnce(
        Response.json({
          available: true,
          publicKey,
          subscribed: true,
          id: "device",
          endpointHash: oldHash,
        }),
      )
      .mockResolvedValueOnce(Response.json({ id: "renewed-device" }));
    expect((await notificationState("owner")).enabled).toBe(true);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/notifications",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          action: "subscribe",
          subscription: subscription.toJSON(),
          replaces: "device",
        }),
      }),
    );
    expect(JSON.parse(values.get("oca-notifications") ?? "null").id).toBe(
      "renewed-device",
    );
  });
  it("keeps a revoked enrollment removable even though delivery is disabled", async () => {
    saved();
    vi.stubGlobal("Notification", { permission: "denied" });
    fetchMock.mockResolvedValue(
      Response.json({
        available: true,
        publicKey,
        subscribed: true,
        id: "device",
        endpointHash: createHash("sha256")
          .update(subscription.endpoint)
          .digest("hex"),
      }),
    );
    expect(await notificationState("owner")).toMatchObject({
      enrolled: true,
      enabled: false,
    });
    await disableNotifications();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
  it("unsubscribes the previous account before enabling for a new account", async () => {
    saved("previous");
    await enableNotifications("owner", publicKey);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledOnce();
    expect(unsubscribe.mock.invocationCallOrder[0]).toBeLessThan(
      subscribe.mock.invocationCallOrder[0] ?? 0,
    );
  });
  it("removes the browser subscription and saved enrollment when accounts change", async () => {
    saved("previous");
    await syncNotificationUser("owner");
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(values.has("oca-notifications")).toBe(false);
  });
  it("turns off browser and server delivery when disabled or logging out", async () => {
    saved();
    await disableNotifications();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notifications",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ id: "device" }),
      }),
    );
    expect(values.has("oca-notifications")).toBe(false);
  });
  it("still deletes server delivery if browser unsubscription fails", async () => {
    saved();
    unsubscribe.mockRejectedValue(new Error("Browser error"));
    await disableNotifications();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notifications",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(values.has("oca-notifications")).toBe(false);
  });
  it("unsubscribes if the server refuses enrollment", async () => {
    saved();
    fetchMock.mockResolvedValue(new Response(null, { status: 502 }));
    await expect(enableNotifications("owner", publicKey)).rejects.toThrow(
      "Couldn't save",
    );
    expect(unsubscribe).toHaveBeenCalledTimes(2);
    expect(values.has("oca-notifications")).toBe(false);
  });
});
