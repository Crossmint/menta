import { describe, expect, it, vi } from "vitest";
import {
  type AddressDefaults,
  addressesForModel,
  type CheckoutsApi,
  type CheckoutView,
  createCheckouts,
  type DeliverTo,
  type Fulfillment,
  forModel,
  fulfillmentOf,
  isPronounLabel,
  matchLabel,
  type NotStarted,
  notStarted,
  notStartedForModel,
  placeOf,
  toAddresses,
  toView,
} from "../extension/lib/checkouts.js";

const ok = (status: number, data: unknown) => ({
  data,
  response: new Response(null, { status: status === 204 ? 204 : 200 }),
});
const fail = (status: number, message: string) => ({
  error: { message },
  response: new Response(null, { status }),
});

const shipping = {
  addressLines: ["1 Main St"],
  locality: "San Francisco",
  administrativeAreaCode: "US-CA",
  postalCode: "94105",
  countryCode: "US",
};

function run(body: { buyerProfileId?: string }) {
  return {
    runId: "run-1",
    revision: 1,
    status: "queued",
    createdAt: "2026-10-05T00:00:00Z",
    browser: null,
    input: {
      request: { startUrl: "https://store.example/item" },
      constraints: { maxCost: { amount: "20.00", currency: "USD" } },
      ...body,
    },
  };
}

/** A buyer profile as Crossmint returns it. */
function profile(id: string, label?: string, locality = "San Francisco") {
  return {
    id,
    ...(label ? { label } : {}),
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    name: { first: "Ada", last: "Lovelace" },
    contact: { email: "ada@example.com", phone: "+1 555 0100" },
    shipping: { ...shipping, locality },
  };
}

function memoryDefaults(initial: string | null = null) {
  let stored = initial;
  return {
    get: vi.fn(async () => stored),
    set: vi.fn(async (_user: string, id: string) => {
      stored = id;
    }),
  } satisfies AddressDefaults;
}

function fakeApi({
  buyers = [] as { id: string }[],
  browsers = [] as { id: string }[],
  browserCreate = ok(201, { id: "browser-new" }) as unknown,
} = {}) {
  let profiles = [...buyers];
  const api = {
    create: vi.fn(async ({ body }) => ok(202, run(body))),
    get: vi.fn(async () => ok(200, run({ buyerProfileId: "buyer-1" }))),
    list: vi.fn(async () =>
      ok(200, {
        data: [run({ buyerProfileId: "buyer-1" }), run({})],
        nextCursor: null,
      }),
    ),
    buyerProfiles: {
      list: vi.fn(async () => ok(200, { data: profiles, nextCursor: null })),
      create: vi.fn(async ({ body }) => {
        const created = { id: "buyer-new", ...body };
        profiles = [created, ...profiles];
        return ok(201, created);
      }),
      update: vi.fn(async ({ path, body }) =>
        ok(200, { id: path.id, ...body }),
      ),
      delete: vi.fn(async ({ path }) => {
        profiles = profiles.filter((item) => item.id !== path.id);
        return ok(204, undefined);
      }),
    },
    browserProfiles: {
      list: vi.fn(async () => ok(200, { data: browsers, nextCursor: null })),
      create: vi.fn(async () => browserCreate),
      delete: vi.fn(async () => ok(204, undefined)),
    },
  };
  return api;
}

/** A started run; fails the test when nothing started. */
function started(result: CheckoutView | NotStarted) {
  if (notStarted(result)) {
    throw new Error("Expected the checkout to start");
  }
  return result;
}

const create = async (
  api: ReturnType<typeof fakeApi>,
  options = {},
  fulfillment: Fulfillment = "pickup",
) =>
  started(
    await createCheckouts({
      api: api as unknown as CheckoutsApi,
      actionUrl: (id) => `https://app.example/checkouts/${id}`,
      ...options,
    }).create("user-1", {
      startUrl: "https://store.example/item",
      maxCost: { amount: "20.00", currency: "USD" },
      fulfillment,
    }),
  );

describe("checkout create attaches the user's Crossmint profiles", () => {
  it("attaches the saved buyer profile and the existing browser profile", async () => {
    const api = fakeApi({
      buyers: [profile("buyer-1", "Home")],
      browsers: [{ id: "browser-1" }],
    });
    const view = await create(
      api,
      { addressDefaults: memoryDefaults("buyer-1") },
      "delivery",
    );
    expect(api.create.mock.calls[0]?.[0]).toMatchObject({
      headers: { "x-crossmint-user-id": "user-1" },
      body: { buyerProfileId: "buyer-1", browser: { profileId: "browser-1" } },
    });
    expect(api.browserProfiles.create).not.toHaveBeenCalled();
    expect(view.usesSavedDetails).toBe(true);
    expect(view.shipsTo).toEqual({ label: "Home", place: "San Francisco, CA" });
  });

  it("creates the browser profile on first use and omits missing buyer details", async () => {
    const api = fakeApi();
    const view = await create(api);
    const body = api.create.mock.calls[0]?.[0].body;
    expect(body.browser).toEqual({ profileId: "browser-new" });
    expect(body).not.toHaveProperty("buyerProfileId");
    expect(view.usesSavedDetails).toBe(false);
    expect(view.shipsTo).toBeNull();
  });

  it("runs without saved sign-ins while a cleared profile is still being erased", async () => {
    const api = fakeApi({ browserCreate: fail(409, "already has one") });
    await create(api);
    expect(api.browserProfiles.list).toHaveBeenCalledTimes(2);
    expect(api.create.mock.calls[0]?.[0].body).not.toHaveProperty("browser");
  });

  it("can be configured off", async () => {
    const api = fakeApi({ buyers: [profile("buyer-1", "Home")] });
    await create(api, { buyerProfiles: false, browserProfiles: false });
    expect(api.buyerProfiles.list).not.toHaveBeenCalled();
    expect(api.browserProfiles.list).not.toHaveBeenCalled();
    const body = api.create.mock.calls[0]?.[0].body;
    expect(body).not.toHaveProperty("buyerProfileId");
    expect(body).not.toHaveProperty("browser");
  });
});

describe("where the checkout browser appears from", () => {
  const start = (
    api: ReturnType<typeof fakeApi>,
    input: { country?: string; fulfillment?: Fulfillment } = {},
    options = {},
  ) =>
    createCheckouts({
      api: api as unknown as CheckoutsApi,
      actionUrl: (id) => `https://app.example/checkouts/${id}`,
      ...options,
    }).create("user-1", {
      startUrl: "https://store.example/",
      maxCost: { amount: "20.00", currency: "USD" },
      fulfillment: input.fulfillment ?? "pickup",
      ...(input.country ? { country: input.country } : {}),
    });
  const bodies = (api: ReturnType<typeof fakeApi>) =>
    api.create.mock.calls.map((call) => call[0].body);
  /** The next create fails with this SDK result. */
  const refuseOnce = (api: ReturnType<typeof fakeApi>, result: unknown) =>
    api.create.mockImplementationOnce((async () => result) as never);

  it("sends the given country as the browser location, next to the profile", async () => {
    const api = fakeApi({ browsers: [{ id: "browser-1" }] });
    await start(api, { country: "gb" });
    expect(bodies(api)).toEqual([
      expect.objectContaining({
        browser: {
          profileId: "browser-1",
          location: { type: "country", countryCode: "GB" },
        },
      }),
    ]);
  });

  it("defaults to the attached address's country", async () => {
    const api = fakeApi({ buyers: [profile("buyer-1", "Home")] });
    await start(
      api,
      {},
      { browserProfiles: false, addressDefaults: memoryDefaults("buyer-1") },
    );
    expect(bodies(api)[0]).toMatchObject({
      buyerProfileId: "buyer-1",
      browser: { location: { type: "country", countryCode: "US" } },
    });
  });

  it("sends no location without a country", async () => {
    const api = fakeApi();
    await start(api, {}, { browserProfiles: false });
    expect(bodies(api)[0]).not.toHaveProperty("browser");
  });

  it("starts again without the location when Crossmint refuses it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const api = fakeApi({ browsers: [{ id: "browser-1" }] });
    refuseOnce(api, {
      // Universal Checkout's error envelope.
      error: {
        error: {
          code: "invalid_request",
          message: "Invalid request",
          details: [
            { path: "browser", message: 'Unrecognized key: "location"' },
          ],
        },
      },
      response: new Response(null, { status: 400 }),
    });
    const view = await start(api, { country: "US" });
    expect(started(view).runId).toBe("run-1");
    expect(bodies(api)).toHaveLength(2);
    expect(bodies(api)[0].browser).toHaveProperty("location");
    expect(bodies(api)[1].browser).toEqual({ profileId: "browser-1" });
    // No merchant guidance of ours: Universal Checkout's own applies.
    expect(bodies(api)[0]).not.toHaveProperty("merchantGuidance");
    expect(bodies(api)[1]).not.toHaveProperty("merchantGuidance");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("drops the whole browser block on retry when the location was all it had", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const api = fakeApi();
    refuseOnce(api, fail(400, "browser.location: Unrecognized key"));
    await start(api, { country: "US" }, { browserProfiles: false });
    expect(bodies(api)[1]).not.toHaveProperty("browser");
    vi.restoreAllMocks();
  });

  it("doesn't retry other failures", async () => {
    const api = fakeApi();
    refuseOnce(api, fail(400, "maxCost.amount must be positive"));
    await expect(
      start(api, { country: "US" }, { browserProfiles: false }),
    ).rejects.toThrow("maxCost");
    expect(api.create).toHaveBeenCalledTimes(1);
  });
});

describe("saved addresses and the default", () => {
  const checkouts = (
    api: ReturnType<typeof fakeApi>,
    addressDefaults?: AddressDefaults,
  ) =>
    createCheckouts({
      api: api as unknown as CheckoutsApi,
      actionUrl: (id) => id,
      ...(addressDefaults ? { addressDefaults } : {}),
    });

  // Crossmint lists newest first.
  const newestFirst = [
    profile("buyer-3", "Mom", "Portland"),
    profile("buyer-2", "Work", "Miami"),
    profile("buyer-1"),
  ];

  it("lists addresses oldest first, labelled, with the stored default marked", () => {
    const list = toAddresses(newestFirst as never, "buyer-2");
    expect(list.map((item) => [item.label, item.isDefault])).toEqual([
      ["Saved address", false],
      ["Work", true],
      ["Mom", false],
    ]);
    expect(list[1]?.place).toBe("Miami, CA");
  });

  it("lets the agent read complete saved buyer facts, retaining labels and the chosen default", () => {
    const list = addressesForModel(
      toAddresses(newestFirst as never, "buyer-2"),
    );
    expect(list).toHaveLength(3);
    expect(list[1]).toEqual({
      id: "buyer-2",
      label: "Work",
      place: "Miami, CA",
      default: true,
      name: { first: "Ada", last: "Lovelace" },
      contact: { email: "ada@example.com", phone: "+1 555 0100" },
      shipping: { ...shipping, locality: "Miami" },
    });
    expect(list[2]?.default).toBe(false);
    expect(list[2]?.label).toBe("Mom");
    expect(JSON.stringify(list)).not.toContain("createdAt");
  });

  it("returns absent buyer facts as absent rather than inventing them", () => {
    const list = addressesForModel(
      toAddresses(
        [{ ...profile("buyer-1"), name: undefined, contact: undefined }],
        null,
      ),
    );
    expect(list[0]?.name).toBeUndefined();
    expect(list[0]?.contact).toBeUndefined();
    expect(list[0]?.shipping).toEqual(shipping);
    expect(list[0]?.default).toBe(false);
  });

  it("has no default until the user picks one: never the newest, never the only one", async () => {
    expect(
      toAddresses(newestFirst as never, null).some((item) => item.isDefault),
    ).toBe(false);
    const gone = await checkouts(
      fakeApi({ buyers: newestFirst }),
      memoryDefaults("deleted"),
    ).addresses("user-1");
    expect(gone.some((item) => item.isDefault)).toBe(false);
    // A lone address isn't the default by itself either: it may be Mom's.
    const [only] = await checkouts(
      fakeApi({ buyers: [profile("buyer-3", "Mom")] }),
      memoryDefaults(),
    ).addresses("user-1");
    expect(only?.isDefault).toBe(false);
  });

  it("never makes a saved address the default by itself, first or not", async () => {
    const defaults = memoryDefaults();
    const api = fakeApi();
    const first = await checkouts(api, defaults).saveAddress("user-1", {
      label: " Partner ",
      details: { name: { first: "Sam", last: "Lee" }, shipping },
    });
    expect(api.buyerProfiles.create.mock.calls[0]?.[0].body).toMatchObject({
      label: "Partner",
    });
    expect(defaults.set).not.toHaveBeenCalled();
    expect(first.addresses).toMatchObject([
      { label: "Partner", isDefault: false },
    ]);
    expect(first.addresses[0]?.details).not.toHaveProperty("id");
  });

  it("makes the user's own place the default when the form says so", async () => {
    const defaults = memoryDefaults("buyer-1");
    const api = fakeApi({ buyers: [profile("buyer-1", "Home")] });
    const saved = await checkouts(api, defaults).saveAddress("user-1", {
      label: "Work",
      details: { shipping },
      makeDefault: true,
    });
    expect(defaults.set).toHaveBeenLastCalledWith("user-1", "buyer-new");
    expect(saved.addresses.find((item) => item.isDefault)?.label).toBe("Work");
  });

  it("sets and clears the default, only for the user's own addresses", async () => {
    const api = fakeApi({ buyers: newestFirst });
    const defaults = memoryDefaults("buyer-2");
    const service = checkouts(api, defaults);
    const set = await service.setDefaultAddress("user-1", "buyer-1");
    expect(set.find((item) => item.isDefault)?.id).toBe("buyer-1");
    // Clearing another address leaves the default alone.
    await service.setDefaultAddress("user-1", "buyer-3", false);
    expect(defaults.set).toHaveBeenCalledTimes(1);
    const cleared = await service.setDefaultAddress("user-1", "buyer-1", false);
    expect(defaults.set).toHaveBeenLastCalledWith("user-1", null);
    expect(cleared.some((item) => item.isDefault)).toBe(false);
    await expect(
      service.setDefaultAddress("user-1", "someone-else"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("leaves no default after deleting it, rather than promoting another", async () => {
    const api = fakeApi({ buyers: newestFirst });
    const defaults = memoryDefaults("buyer-2");
    const left = await checkouts(api, defaults).deleteAddress(
      "user-1",
      "buyer-2",
    );
    expect(api.buyerProfiles.delete).toHaveBeenCalledWith({
      headers: { "x-crossmint-user-id": "user-1" },
      path: { id: "buyer-2" },
    });
    expect(left.some((item) => item.isDefault)).toBe(false);
  });

  it("refuses a label the user already has, as labels match", async () => {
    const api = fakeApi({ buyers: [profile("buyer-1", "Home")] });
    for (const label of ["home", "My home", "Home address"]) {
      await expect(
        checkouts(api).saveAddress("user-1", { label, details: { shipping } }),
      ).rejects.toMatchObject({ code: "duplicate_label", status: 400 });
    }
    expect(api.buyerProfiles.create).not.toHaveBeenCalled();
    // Keeping its own label is fine.
    await checkouts(api).saveAddress("user-1", {
      id: "buyer-1",
      label: "HOME",
      details: { shipping },
    });
    expect(api.buyerProfiles.update).toHaveBeenCalledOnce();
  });

  it("replaces name and contact and clears optional address fields on update", async () => {
    const api = fakeApi({ buyers: [profile("buyer-1", "Home")] });
    await checkouts(api).saveAddress("user-1", {
      id: "buyer-1",
      label: "Home",
      details: {
        shipping: {
          addressLines: ["2 High St"],
          locality: "London",
          countryCode: "GB",
        },
      },
    });
    expect(api.buyerProfiles.update.mock.calls[0]?.[0]).toMatchObject({
      path: { id: "buyer-1" },
      body: {
        label: "Home",
        name: {},
        contact: {},
        shipping: { administrativeAreaCode: null, postalCode: null },
      },
    });
  });

  it("only changes the user's own addresses", async () => {
    const api = fakeApi({ buyers: [profile("buyer-1", "Home")] });
    await expect(
      checkouts(api).saveAddress("user-1", {
        id: "someone-else",
        label: "Mine",
        details: { shipping },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("surfaces Crossmint's validation message", async () => {
    const api = fakeApi();
    api.buyerProfiles.create.mockResolvedValueOnce(
      fail(400, "Use an ISO 3166-2 subdivision code") as never,
    );
    await expect(
      checkouts(api).saveAddress("user-1", {
        label: "Home",
        details: { shipping },
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Use an ISO 3166-2 subdivision code",
    });
  });
});

/** The user's saved addresses, newest first, with Home as the default. */
const homeAndPeople = () => [
  profile("buyer-3", "Sarah Lee", "Austin"),
  profile("buyer-2", "Partner", "East Hampton"),
  profile("buyer-4", "Work", "Miami"),
  profile("buyer-1", "Home"),
];

/** Starts a checkout for `user-1` and returns what Crossmint was sent, or nothing. */
async function attempt(
  buyers: { id: string }[],
  input: {
    fulfillment?: Fulfillment;
    deliverTo?: DeliverTo;
    addressLabel?: string;
    cityHint?: string;
  },
  defaultId: string | null = "buyer-1",
) {
  const api = fakeApi({ buyers, browsers: [{ id: "browser-1" }] });
  const result = await createCheckouts({
    api: api as unknown as CheckoutsApi,
    actionUrl: String,
    addressDefaults: memoryDefaults(defaultId),
  }).create("user-1", {
    startUrl: "https://www.ubereats.com/",
    task: "The perfect egg sandwich from Pura Vida",
    maxCost: { amount: "40.00", currency: "USD" },
    ...input,
  });
  const body = api.create.mock.calls[0]?.[0].body;
  return {
    api,
    result,
    body,
    profile: body?.buyerProfileId ?? null,
  };
}

describe("the decision table (docs/ADDRESSES.md)", () => {
  it.each(["pickup", "none"] as const)(
    "%s: never asks; attaches only the user's own default, for contact details",
    async (fulfillment) => {
      for (const input of [
        {},
        { deliverTo: "someone_else" as const, addressLabel: "Mom" },
        { addressLabel: "Partner" },
      ]) {
        const run = await attempt(homeAndPeople(), { fulfillment, ...input });
        expect(run.profile).toBe("buyer-1");
        expect(run.body).not.toHaveProperty("merchantGuidance");
      }
      const bare = await attempt([], { fulfillment });
      expect(bare.api.create).toHaveBeenCalledOnce();
      expect(bare.profile).toBeNull();
      // A person's address, with no default, is never used for a pickup.
      const theirs = await attempt(
        [profile("buyer-2", "Partner")],
        { fulfillment },
        null,
      );
      expect(theirs.profile).toBeNull();
    },
  );

  it("delivery to the user with a store account and no saved address: starts at once, nothing attached", async () => {
    // "Order the egg sandwich from Pura Vida on Uber Eats" with no address saved.
    const run = await attempt([], { fulfillment: "delivery" }, null);
    expect(started(run.result).status).toBe("queued");
    expect(run.profile).toBeNull();
    expect(run.body.browser).toEqual({ profileId: "browser-1" });
  });

  it("delivery to the user with an own default: attaches it as the buyer's own", async () => {
    const run = await attempt(homeAndPeople(), { fulfillment: "delivery" });
    expect(run.profile).toBe("buyer-1");
    expect(started(run.result).shipsTo).toEqual({
      label: "Home",
      place: "San Francisco, CA",
    });
    // An own place they name ("to work").
    const work = await attempt(homeAndPeople(), {
      fulfillment: "delivery",
      addressLabel: "my work",
    });
    expect(work.profile).toBe("buyer-4");
  });

  it("delivery to the user with nothing saved: starts anyway, and the store asks", async () => {
    const run = await attempt([], { fulfillment: "delivery" }, null);
    expect(run.api.create).toHaveBeenCalledOnce();
    // "Ship it to me" is the same.
    const me = await attempt([], { addressLabel: "me" }, null);
    expect(me.api.create).toHaveBeenCalledOnce();
    expect(me.profile).toBeNull();
  });

  it("delivery to the user when only someone else's address is saved: never offers theirs", async () => {
    // Bug: "deliver to my house" shipped to the partner's default.
    const run = await attempt(
      [profile("buyer-2", "Partner", "East Hampton")],
      { fulfillment: "delivery", deliverTo: "me" },
      null,
    );
    expect(run.profile).toBeNull();
    expect(run.api.create).toHaveBeenCalledOnce();
  });

  it("delivery to an own place that isn't saved: starts without an address, naming the place", async () => {
    const run = await attempt(homeAndPeople(), { addressLabel: "Cabin" });
    expect(run.profile).toBeNull();
  });

  it("delivery to someone else who is saved: attaches theirs as the recipient's", async () => {
    const run = await attempt(homeAndPeople(), {
      deliverTo: "someone_else",
      addressLabel: "my partner",
    });
    expect(run.profile).toBe("buyer-2");
    expect(started(run.result).shipsTo).toMatchObject({ label: "Partner" });
  });

  it("delivery to someone else who isn't saved: the only case that stops, for the form", async () => {
    const run = await attempt(homeAndPeople(), {
      deliverTo: "someone_else",
      addressLabel: " Mom ",
      cityHint: "Tampa",
    });
    expect(run.result).toEqual({
      status: "needs_address",
      label: "Mom",
      cityHint: "Tampa",
      startUrl: "https://www.ubereats.com/",
      store: "ubereats.com",
      task: "The perfect egg sandwich from Pura Vida",
      maxCost: { amount: "40.00", currency: "USD" },
    });
    expect(run.api.create).not.toHaveBeenCalled();
    expect(run.api.browserProfiles.create).not.toHaveBeenCalled();
  });

  it("delivery to the store account's address: attaches nothing, even with a default", async () => {
    // "Log in first so you'll have my address already."
    const run = await attempt(homeAndPeople(), {
      fulfillment: "delivery",
      deliverTo: "store_account",
      addressLabel: "Home",
    });
    expect(run.profile).toBeNull();
    expect(run.body.browser).toEqual({ profileId: "browser-1" });
    expect(started(run.result).shipsTo).toBeNull();
  });

  it("treats a missing fulfillment as a delivery to the user", async () => {
    const run = await attempt(homeAndPeople(), {});
    expect(run.profile).toBe("buyer-1");
    expect(started(run.result).fulfillment).toBe("delivery");
  });

  it("still reads the fulfillment of runs started with our old guidance", () => {
    expect(fulfillmentOf("Fulfillment: pickup. The buyer collects…")).toBe(
      "pickup",
    );
    expect(fulfillmentOf("Fulfillment: no shipping (digital goods…)")).toBe(
      "none",
    );
    expect(fulfillmentOf(undefined)).toBe("delivery");
  });
});

describe("invariant: needs_address only ever asks for someone else's address", () => {
  it("holds across every fulfillment, recipient, label and saved state", async () => {
    const savedStates = [
      { buyers: [], defaultId: null },
      { buyers: homeAndPeople(), defaultId: "buyer-1" },
      { buyers: homeAndPeople(), defaultId: null },
      { buyers: [profile("buyer-2", "Partner")], defaultId: null },
    ];
    const labels = [undefined, "Home", "Mom", "Cabin", "me"];
    for (const { buyers, defaultId } of savedStates) {
      for (const fulfillment of ["delivery", "pickup", "none"] as const) {
        for (const deliverTo of [
          "me",
          "store_account",
          "someone_else",
        ] as const) {
          for (const addressLabel of labels) {
            const input = {
              fulfillment,
              deliverTo,
              ...(addressLabel ? { addressLabel } : {}),
            };
            const outcome = await attempt(buyers, input, defaultId).then(
              (run) => run.result.status,
              () => "error",
            );
            const someoneElse =
              fulfillment === "delivery" && deliverTo === "someone_else";
            if (outcome === "needs_address") {
              expect({ input, someoneElse }).toEqual({
                input,
                someoneElse: true,
              });
            }
            if (outcome === "error") {
              // Only someone else with no usable label is refused.
              expect(
                someoneElse && (!addressLabel || addressLabel === "me"),
              ).toBe(true);
            }
          }
        }
      }
    }
  });
});

describe("matching a person to a saved label", () => {
  const list = toAddresses(homeAndPeople() as never, "buyer-1");
  const label = (requested: string) => {
    const { match, similar } = matchLabel(list, requested);
    return {
      match: match?.label ?? null,
      similar: similar.map((a) => a.label),
    };
  };

  it("matches by the same words, ignoring case, punctuation, my/the, 's and address", () => {
    for (const requested of [
      "partner",
      "My partner",
      "the Partner",
      "partner's address",
      "Partner’s",
    ]) {
      expect(label(requested)).toEqual({ match: "Partner", similar: [] });
    }
    expect(label("sarah lee").match).toBe("Sarah Lee");
  });

  it("finds look-alikes that share all their words, and nothing else", () => {
    expect(label("Sarah")).toEqual({ match: null, similar: ["Sarah Lee"] });
    expect(label("Sarah Lee Jones")).toEqual({
      match: null,
      similar: ["Sarah Lee"],
    });
    expect(label("Mom")).toEqual({ match: null, similar: [] });
    expect(label("office")).toEqual({ match: null, similar: [] });
  });

  it("asks which one, starting nothing, when a label only looks like saved ones", async () => {
    const run = await attempt(homeAndPeople(), {
      deliverTo: "someone_else",
      addressLabel: "Sarah",
    });
    expect(run.result).toEqual({
      status: "which_address",
      requested: "Sarah",
      options: [{ label: "Sarah Lee", place: "Austin, CA" }],
    });
    expect(run.api.create).not.toHaveBeenCalled();
    if (!notStarted(run.result)) {
      throw new Error("Expected which_address");
    }
    const model = notStartedForModel(run.result, {
      start: "checkouts__create",
      save: "checkouts__save_address",
    });
    expect(model.next).toContain('"Sarah Lee" (Austin, CA)');
    expect(model.next).toContain("Ask the user in one short line");
  });

  it("turns away a pronoun or a missing label for someone else, naming the saved labels", async () => {
    for (const addressLabel of ["her", "his place", undefined]) {
      const api = fakeApi({ buyers: homeAndPeople() });
      await expect(
        createCheckouts({
          api: api as unknown as CheckoutsApi,
          actionUrl: String,
        }).create("user-1", {
          startUrl: "https://www.flowers.example/",
          maxCost: { amount: "80.00", currency: "USD" },
          deliverTo: "someone_else",
          ...(addressLabel ? { addressLabel } : {}),
        }),
      ).rejects.toMatchObject({
        code: "address_label",
        message: expect.stringContaining('"Partner"'),
      });
      expect(api.create).not.toHaveBeenCalled();
    }
    expect(isPronounLabel("her")).toBe(true);
    expect(isPronounLabel("Herb")).toBe(false);
  });

  it("tells the model to ask in chat and save it, never showing a street", async () => {
    const run = await attempt(homeAndPeople(), {
      deliverTo: "someone_else",
      addressLabel: "Mom",
    });
    if (!notStarted(run.result)) {
      throw new Error("Expected needs_address");
    }
    const model = notStartedForModel(run.result, {
      start: "checkouts__create",
      save: "checkouts__save_address",
    });
    expect(model.next).toContain("Ask the user in chat");
    expect(model.next).toContain(
      'checkouts__save_address with recipient "someone_else" and label "Mom"',
    );
    expect(model.next).toContain("checkouts__create again");
    expect(model.next).toContain('deliverTo "someone_else"');
    expect(JSON.stringify(model)).not.toContain("Main St");
  });
});

describe("where a checkout ships, as the views show it", () => {
  it("says the label and city only, never the street or name", async () => {
    const api = fakeApi({ buyers: [profile("buyer-1", "Home")] });
    const checkouts = createCheckouts({
      api: api as unknown as CheckoutsApi,
      actionUrl: String,
    });
    const view = await checkouts.get("user-1", "run-1");
    expect(view.shipsTo).toEqual({ label: "Home", place: "San Francisco, CA" });
    const model = JSON.stringify(forModel(view));
    expect(model).not.toContain("Main St");
    expect(model).not.toContain("Lovelace");

    const page = await checkouts.list("user-1", {});
    expect(page.runs.map((item) => item.shipsTo?.label ?? null)).toEqual([
      "Home",
      null,
    ]);
    expect(api.buyerProfiles.list).toHaveBeenCalledTimes(2);
  });

  it("drops the line, not the checkout, when the address can't be read", async () => {
    const api = fakeApi({ buyers: [profile("buyer-1", "Home")] });
    api.buyerProfiles.list.mockResolvedValueOnce(fail(500, "down") as never);
    const view = await createCheckouts({
      api: api as unknown as CheckoutsApi,
      actionUrl: String,
    }).get("user-1", "run-1");
    expect(view.usesSavedDetails).toBe(true);
    expect(view.shipsTo).toBeNull();
  });

  it("formats places by city and region or country", () => {
    expect(placeOf(shipping)).toBe("San Francisco, CA");
    expect(
      placeOf({
        addressLines: ["1 Rue X"],
        locality: "Paris",
        administrativeAreaCode: "FR-75",
        countryCode: "FR",
      }),
    ).toBe("Paris, France");
  });
});

describe("store sign-ins", () => {
  it("deletes the browser profile when cleared and does nothing when none exists", async () => {
    const api = fakeApi({ browsers: [{ id: "browser-1" }] });
    const checkouts = createCheckouts({
      api: api as unknown as CheckoutsApi,
      actionUrl: (id) => id,
    });
    expect(await checkouts.hasSavedSignIns("user-1")).toBe(true);
    await checkouts.clearSignIns("user-1");
    expect(api.browserProfiles.delete).toHaveBeenCalledWith({
      headers: { "x-crossmint-user-id": "user-1" },
      path: { id: "browser-1" },
    });

    const empty = fakeApi();
    await createCheckouts({
      api: empty as unknown as CheckoutsApi,
      actionUrl: (id) => id,
    }).clearSignIns("user-1");
    expect(empty.browserProfiles.delete).not.toHaveBeenCalled();
  });
});

describe("store questions", () => {
  const option = (value: string, label: string, flags = {}) => ({
    value,
    label,
    disabled: false,
    placeholder: false,
    selected: false,
    ...flags,
  });
  const month = (options: ReturnType<typeof option>[]) => ({
    key: "month",
    label: "Month",
    required: true,
    handling: "standard",
    input: { kind: "choice", selection: { kind: "one" }, options },
  });
  const awaiting = (fields: unknown[]) =>
    ({
      ...run({}),
      status: "awaiting_input",
      requiredAction: {
        requestId: "req-1",
        request: {
          question: "When do you leave?",
          expiresAt: null,
          interaction: { kind: "form", fields },
        },
      },
    }) as unknown as Parameters<typeof toView>[0];
  const labels = (view: ReturnType<typeof toView>) =>
    view.pending && "standard" in view.pending
      ? view.pending.standard[0]?.options?.map((item) => item.label)
      : view.pending?.kind === "question"
        ? view.pending.fields[0]?.options?.map((item) => item.label)
        : undefined;

  it("drops prompts and disabled options, flagged or not", () => {
    const options = [
      option("", "Select"),
      option("1", "January"),
      option("2", "February", { disabled: true }),
      option("3", "March"),
      option("x", "Pick one", { placeholder: true }),
    ];
    expect(labels(toView(awaiting([month(options)]), String))).toEqual([
      "January",
      "March",
    ]);
    expect(
      labels(
        toView(
          awaiting([
            month([
              option("0", "-- Select a month --"),
              option("1", "January"),
            ]),
          ]),
          String,
        ),
      ),
    ).toEqual(["January"]);
    expect(
      labels(
        toView(
          awaiting([
            month([option("s", "Selection box"), option("1", "Other")]),
          ]),
          String,
        ),
      ),
      "a real option that starts like a prompt",
    ).toEqual(["Selection box", "Other"]);
  });

  it("drops them from the ordinary fields of a request with private fields too", () => {
    const code = {
      key: "code",
      label: "Code",
      required: true,
      handling: "protected",
      input: { kind: "text" },
    };
    const view = toView(
      awaiting([code, month([option("", "Select"), option("1", "January")])]),
      String,
    );
    expect(view.pending?.kind).toBe("protected");
    expect(labels(view)).toEqual(["January"]);
  });

  it("flags ordinary fields that look secret, so no host form asks them", () => {
    const text = (key: string, input: Record<string, unknown>) => ({
      key,
      label: key,
      required: true,
      handling: "standard",
      input: { kind: "text", ...input },
    });
    const view = toView(
      awaiting([
        text("plain", { autoComplete: "email" }),
        text("masked", { display: "masked" }),
        text("otp", { autoComplete: "one-time-code" }),
        text("password", { autoComplete: "current-password" }),
      ]),
      String,
    );
    expect(
      view.pending?.kind === "question" &&
        view.pending.fields.map((field) => [field.key, field.sensitive]),
    ).toEqual([
      ["plain", undefined],
      ["masked", true],
      ["otp", true],
      ["password", true],
    ]);
  });
});

describe("whether a request was already answered", () => {
  function withMessages(pages: unknown[][] | null) {
    const list = vi.fn(async ({ query }: { query: { cursor?: string } }) => {
      if (!pages) {
        throw new Error("network");
      }
      const index = query.cursor ? Number(query.cursor) : 0;
      return {
        data: {
          data: pages[index],
          nextCursor: index + 1 < pages.length ? String(index + 1) : null,
          streamCursor: "s",
        },
      };
    });
    const checkouts = createCheckouts({
      api: { messages: { list } } as unknown as CheckoutsApi,
      actionUrl: String,
    });
    return { checkouts, list };
  }
  const answer = (requestId: string, part?: object) => ({
    id: "m",
    role: "user",
    revision: 1,
    createdAt: "2026-11-03T12:00:00Z",
    parts: [
      part ?? {
        type: "input_response",
        action: "submit",
        requestId,
        response: { kind: "payment", application: "not_attempted" },
      },
    ],
  });

  it("finds a payment on any page, and only for that request", async () => {
    const { checkouts, list } = withMessages([
      [answer("req-1")],
      [answer("req-pay")],
    ]);
    expect(await checkouts.answer("user-1", "run-1", "req-pay")).toBe(
      "payment",
    );
    expect(list).toHaveBeenCalledTimes(2);
    expect(await checkouts.answer("user-1", "run-1", "req-2")).toBeNull();
  });

  it("tells a payment from a decline or an alternative", async () => {
    const { checkouts } = withMessages([
      [
        answer("req-d", {
          type: "input_response",
          action: "decline",
          requestId: "req-d",
        }),
        answer("req-a", {
          type: "input_response",
          action: "alternative",
          requestId: "req-a",
          text: "Use PayPal",
        }),
      ],
    ]);
    expect(await checkouts.answer("user-1", "run-1", "req-d")).toBe("other");
    expect(await checkouts.answer("user-1", "run-1", "req-a")).toBe("other");
  });

  it("throws when the messages can't be read, so nothing pays", async () => {
    const { checkouts } = withMessages(null);
    await expect(
      checkouts.answer("user-1", "run-1", "req-pay"),
    ).rejects.toThrow();
  });
});
