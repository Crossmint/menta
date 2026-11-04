/**
 * Dev tool: the real Menta MCP server (tools, checkout card resource)
 * over fake Crossmint checkouts in every state, without auth, so an MCP Apps
 * host can render the card locally. Never talks to Crossmint.
 *
 *   pnpm card:fixtures
 *   → http://localhost:3401/mcp
 *
 * Any MCP Apps host works, e.g. the spec's reference host: in a clone of
 * github.com/modelcontextprotocol/ext-apps, examples/basic-host, run
 * `SERVERS='["http://localhost:3401/mcp"]' npm start` and open :8080.
 *
 * Ask the host to call start (a new run walks through a question and a
 * payment; start and continue follow it without a card), then
 * show_checkout_step with its runId, or with one of the runIds this prints,
 * to draw the card. Store questions accept an answer and move on;
 * `GET /fixture/approve?runId=fx-payment` stands in for approving on the
 * secure page.
 *
 * The card's fonts and secure-step script come from this server too (as
 * they do from the web app), unless OCA_WEB_ORIGIN points elsewhere.
 *
 * The in-card secure step is on (FIXTURE_SECURE=0 turns it off). Its
 * credentials are inert: Crossmint's real frames load into the card but
 * reject the fake JWT, which exercises the fallback. Set
 * FIXTURE_CLIENT_KEY to a client key to see Crossmint's frames render.
 */
import { createServer } from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createCheckouts } from "@oca/crossmint-agent-checkouts/checkouts";
import {
  checkoutCardFonts,
  checkoutCardSecureScript,
  createCommerceServer,
} from "../dist/mcp/index.js";

const port = Number(process.env.PORT ?? 3401);
const origin = process.env.OCA_WEB_ORIGIN ?? `http://localhost:${port}`;

/** Saved addresses (buyer profiles), newest first: "Home" is the default. */
const profiles = [
  {
    id: "fx-home",
    label: "Home",
    createdAt: "2026-10-02T00:00:00Z",
    updatedAt: "2026-10-02T00:00:00Z",
    name: { first: "Ada", last: "Lovelace" },
    shipping: {
      // A canary: the card and the model must never see the street.
      addressLines: ["1 STREET_CANARY Ave"],
      locality: "Miami",
      administrativeAreaCode: "US-FL",
      postalCode: "33101",
      countryCode: "US",
    },
  },
  {
    id: "fx-mom",
    label: "Mom",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    shipping: {
      addressLines: ["2 STREET_CANARY St"],
      locality: "Portland",
      administrativeAreaCode: "US-OR",
      countryCode: "US",
    },
  },
];

/** Which address each run ships to (Home unless the checkout asked for another). */
const shipTo = new Map();

function run(runId, status, task, extra = {}) {
  return {
    runId,
    revision: 1,
    status,
    createdAt: new Date().toISOString(),
    input: {
      request: {
        startUrl: runId.startsWith("fx-toy")
          ? "https://www.amazon.com/"
          : "https://www.halfmoonroasters.example/espresso",
        task,
      },
      constraints: { maxCost: { amount: "40.00", currency: "USD" } },
      buyerProfileId: shipTo.get(runId) ?? "fx-home",
    },
    // A capability URL with a canary: the model and the card must never see it.
    browser: {
      embedUrl: `https://live.invalid/${runId}?LIVE_VIEW_CANARY`,
    },
    ...extra,
  };
}

function awaiting(runId, task, requestId, question, interaction) {
  return run(runId, "awaiting_input", task, {
    requiredAction: {
      requestId,
      request: { question, expiresAt: null, interaction },
    },
  });
}

const field = (key, label, input, required = true, handling = "standard") => ({
  key,
  label,
  required,
  handling,
  input,
});

const espresso = "Halfmoon Espresso, 2 lb bag";
const toy = "Interactive cat toy for an indoor cat, under $15";
const payment = {
  kind: "payment",
  amount: { kind: "exact", value: "31.50", currency: "USD" },
  merchant: {
    name: "Halfmoon Roasters",
    url: "https://www.halfmoonroasters.example",
    countryCode: "US",
  },
};
/** The cat toy at Amazon: its question and payment. */
const toyQuestion =
  "Amazon lists a few interactive cat toys under your limit. Which one do you want?";
const toyAsk = {
  kind: "form",
  fields: [
    field("toy", "Toy", {
      kind: "choice",
      selection: { kind: "one" },
      options: [
        { value: "wand", label: "Feather wand with bell, 2 refills ($8.99)" },
        { value: "mouse", label: "Catnip mice, 6 pack ($6.49)" },
        { value: "track", label: "Ball track tower, 3 levels ($12.99)" },
      ],
    }),
  ],
};
const toyPayment = {
  ...payment,
  amount: { kind: "exact", value: "10.27", currency: "USD" },
  merchant: {
    name: "Amazon.com",
    url: "https://www.amazon.com",
    countryCode: "US",
  },
};
const succeeded = (runId) => {
  const isToy = runId.startsWith("fx-toy");
  return run(runId, "succeeded", isToy ? toy : espresso, {
    result: {
      summary: "Order placed.",
      purchase: {
        kind: "receipt_captured",
        receipt: {
          total: { amount: isToy ? "10.27" : "31.50", currency: "USD" },
          merchantOrderId: isToy ? "112-0000000-0000000" : "HM-11872",
        },
      },
    },
  });
};

const runs = new Map(
  [
    run("fx-toy", "running", toy),
    awaiting("fx-toy-question", toy, "req-toy", toyQuestion, toyAsk),
    awaiting(
      "fx-toy-payment",
      toy,
      "req-toy-pay",
      "Approve the payment",
      toyPayment,
    ),
    run("fx-toy-done", "succeeded", toy, {
      result: {
        summary: "Order placed.",
        purchase: {
          kind: "receipt_captured",
          receipt: {
            total: { amount: "10.27", currency: "USD" },
            merchantOrderId: "112-0000000-0000000",
          },
        },
      },
    }),
    run("fx-starting", "queued", espresso),
    run("fx-working", "running", espresso),
    awaiting("fx-question", espresso, "req-grind", "Which grind do you want?", {
      kind: "form",
      fields: [
        field("grind", "Grind", {
          kind: "choice",
          selection: { kind: "one" },
          options: [
            { value: "whole", label: "Whole bean" },
            { value: "espresso", label: "Espresso" },
            { value: "filter", label: "Filter" },
          ],
        }),
      ],
    }),
    awaiting("fx-yesno", espresso, "req-sub", "Substitute if out of stock?", {
      kind: "form",
      fields: [field("substitute", "Substitute", { kind: "boolean" })],
    }),
    awaiting("fx-form", espresso, "req-form", "A few details for the order", {
      kind: "form",
      fields: [
        field(
          "note",
          "Gift note",
          { kind: "text", placeholder: "Optional" },
          false,
        ),
        field("bags", "Number of bags", { kind: "integer" }),
        field("extras", "Extras", {
          kind: "choice",
          selection: { kind: "many" },
          options: [
            { value: "filters", label: "Paper filters" },
            { value: "scoop", label: "Scoop" },
          ],
        }),
      ],
    }),
    awaiting("fx-payment", espresso, "req-pay", "Approve the payment", payment),
    awaiting(
      "fx-protected",
      espresso,
      "req-code",
      "Enter the code the store sent",
      {
        kind: "form",
        fields: [
          field(
            "code",
            "Verification code",
            { kind: "text", inputMode: "numeric" },
            true,
            "protected",
          ),
        ],
      },
    ),
    awaiting("fx-signin", espresso, "req-signin", "Sign in to the store", {
      kind: "form",
      fields: [
        field("email", "Email", { kind: "text", placeholder: "you@example" }),
        field(
          "password",
          "Password",
          { kind: "text", display: "masked", autoComplete: "current-password" },
          true,
          "protected",
        ),
      ],
    }),
    succeeded("fx-succeeded"),
    run("fx-noreceipt", "succeeded", espresso, {
      result: {
        summary: "Confirmed.",
        purchase: { kind: "confirmed_without_receipt" },
      },
    }),
    run("fx-blocked", "blocked", "Brass desk lamp", {
      result: {
        summary: "The lamp is out of stock in brass.",
        code: "product.item_unavailable",
      },
    }),
    run("fx-unconfirmed", "blocked", "Linen napkins, set of 6", {
      result: {
        summary: "The store did not confirm the order.",
        code: "reconciliation_required",
      },
    }),
    run("fx-failed", "failed", espresso, { reason: "cost_limit" }),
    run("fx-cancelled", "cancelled", espresso, {
      result: { summary: "Cancelled by the user." },
    }),
  ].map((item) => [item.runId, item]),
);

/**
 * The browser agent's steps, as Crossmint publishes them: one assistant
 * message per tool call, with its buyer-facing line and what it did.
 */
const journey = [
  ["Opening Halfmoon Roasters", ["navigate"]],
  ["Searching the store for Halfmoon Espresso", ["search_catalog"]],
  ["Opening the Halfmoon Espresso product page", ["lookup_product"]],
  ["Choosing the 2 lb bag", ["select"]],
  ["Adding the 2 lb bag to the cart", ["click"]],
  ["Going to checkout", ["create_checkout"]],
  [
    "Filling in the delivery details from your Home address",
    ["apply_buyer_information"],
  ],
  ["Choosing standard shipping, the cheapest option", ["select"]],
  ["Checking the order total before asking you to pay", ["observe"]],
];
/** The same journey at Amazon, for the cat-toy runs. */
const toyJourney = [
  ["Opening Amazon", ["navigate"]],
  ["Searching Amazon for interactive cat toys", ["search_catalog"]],
  ["Comparing three toys under your limit", ["lookup_product"]],
  ["Opening the feather wand", ["lookup_product"]],
  ["Adding the feather wand to the cart", ["click"]],
  ["Going to checkout", ["create_checkout"]],
  [
    "Filling in the delivery details from your Home address",
    ["apply_buyer_information"],
  ],
  ["Choosing free delivery", ["select"]],
  ["Checking the order total before asking you to pay", ["observe"]],
];
const STEP_MS = 8000;
const booted = Date.now();
/** How many steps each run gets to, and when its first one started. */
const reaches = {
  "fx-toy": journey.length,
  "fx-toy-question": 4,
  "fx-toy-payment": 9,
  "fx-working": journey.length,
  "fx-question": 4,
  "fx-yesno": 5,
  "fx-form": 7,
  "fx-payment": 9,
  "fx-protected": 7,
  "fx-signin": 2,
};
const startedAt = new Map(
  Object.entries(reaches).map(([runId, steps]) => [
    runId,
    // fx-working walks through its steps live; the others got there just now.
    runId === "fx-working" ? booted : booted - steps * STEP_MS,
  ]),
);

/** A run's messages so far: a step runs for 5 s, then it is completed (revision 2). */
function messagesOf(runId) {
  const start = startedAt.get(runId);
  const reach = reaches[runId] ?? 4;
  if (start === undefined) {
    return [];
  }
  const now = Date.now();
  const due = Math.min(reach, Math.floor((now - start) / STEP_MS) + 1);
  const steps = runId.startsWith("fx-toy") ? toyJourney : journey;
  return steps.slice(0, due).map(([text, kinds], index) => {
    const at = start + index * STEP_MS;
    const running = now < at + 5000;
    return {
      id: `${runId}-step-${index}`,
      revision: running ? 1 : 2,
      role: "assistant",
      createdAt: new Date(at).toISOString(),
      parts: [
        { type: "text", text },
        {
          type: "activity",
          status: running ? "running" : "completed",
          operations: kinds.map((kind) => ({ kind, count: 1 })),
        },
      ],
    };
  });
}

/** Moves a run along after an answer or approval, the way Crossmint would. */
function later(ms, runId, next) {
  setTimeout(() => runs.set(runId, next), ms);
}

let created = 0;
const ok = (data) => Promise.resolve({ data });
const missing = () =>
  Promise.resolve({ error: { message: "Checkout not found." } });
const api = {
  create: ({ body }) => {
    const runId = `${/cat/i.test(body.request.task ?? "") ? "fx-toy-new" : "fx-new"}-${++created}`;
    const task = body.request.task ?? "Item";
    if (body.buyerProfileId) {
      shipTo.set(runId, body.buyerProfileId);
    }
    startedAt.set(runId, Date.now() + 3000);
    runs.set(runId, run(runId, "queued", task));
    later(3000, runId, run(runId, "running", task));
    later(
      9000,
      runId,
      runId.startsWith("fx-toy")
        ? awaiting(runId, task, `req-${runId}`, toyQuestion, toyAsk)
        : awaiting(runId, task, `req-${runId}`, "Which size?", {
            kind: "form",
            fields: [
              field("size", "Size", {
                kind: "choice",
                selection: { kind: "one" },
                options: [
                  { value: "s", label: "Small" },
                  { value: "m", label: "Medium" },
                ],
              }),
            ],
          }),
    );
    return ok(runs.get(runId));
  },
  get: ({ path }) => (runs.has(path.id) ? ok(runs.get(path.id)) : missing()),
  buyerProfiles: {
    list: () => ok({ data: profiles, nextCursor: null }),
  },
  list: () => ok({ data: [...runs.values()].slice(0, 10), nextCursor: null }),
  cancel: ({ path }) => {
    const current = runs.get(path.id);
    if (!current) {
      return missing();
    }
    runs.set(
      path.id,
      run(path.id, "cancelled", current.input.request.task, {
        result: { summary: "Cancelled by the user." },
      }),
    );
    return ok({ accepted: true });
  },
  messages: {
    // The whole history every time: re-reading is harmless, a higher revision wins.
    list: ({ path }) =>
      runs.has(path.id)
        ? ok({
            data: messagesOf(path.id),
            nextCursor: null,
            streamCursor: `fx-${path.id}`,
          })
        : missing(),
    create: ({ path, body }) => {
      const current = runs.get(path.id);
      if (!current) {
        return missing();
      }
      const task = current.input.request.task;
      runs.set(path.id, run(path.id, "running", task));
      if (body?.parts?.[0]?.response?.kind === "payment") {
        later(5000, path.id, succeeded(path.id));
        return ok({ accepted: true });
      }
      later(
        6000,
        path.id,
        awaiting(
          path.id,
          task,
          `req-pay-${path.id}`,
          "Approve the payment",
          path.id.startsWith("fx-toy") ? toyPayment : payment,
        ),
      );
      return ok({ accepted: true });
    },
  },
};

const checkouts = createCheckouts({
  api,
  actionUrl: (runId) => `${origin}/checkouts/${encodeURIComponent(runId)}`,
  addressDefaults: { get: async () => "fx-home", set: async () => {} },
  browserProfiles: false,
});

/** Inert credentials: a real-looking shape Crossmint will reject. */
const secure =
  process.env.FIXTURE_SECURE === "0"
    ? null
    : {
        crossmintOrigin: "https://www.crossmint.com",
        mint: async () => ({
          apiKey: process.env.FIXTURE_CLIENT_KEY ?? "ck_production_fixture",
          jwt: "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJmaXh0dXJlIn0.Zml4dHVyZQ",
          expiresAt: Date.now() + 5 * 60_000,
        }),
      };

const handler = createMcpHandler(() =>
  createCommerceServer({
    userId: "fixture-user",
    checkouts,
    origin,
    host: "local",
    secure,
  }),
);

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-expose-headers": "*",
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors).end();
    return;
  }
  if (url.pathname === "/mcp/card/secure.js") {
    res
      .writeHead(200, {
        ...cors,
        "content-type": "text/javascript; charset=utf-8",
      })
      .end(checkoutCardSecureScript);
    return;
  }
  if (url.pathname.startsWith("/mcp/card/fonts/")) {
    const font =
      checkoutCardFonts[url.pathname.slice("/mcp/card/fonts/".length)];
    res
      .writeHead(font ? 200 : 404, { ...cors, "content-type": "font/woff2" })
      .end(font ? Buffer.from(font, "base64") : undefined);
    return;
  }
  if (url.pathname === "/fixture/approve") {
    const runId = url.searchParams.get("runId") ?? "";
    if (runs.has(runId)) {
      runs.set(
        runId,
        run(runId, "running", runs.get(runId).input.request.task),
      );
      later(5000, runId, succeeded(runId));
    }
    res.writeHead(200, { ...cors, "content-type": "text/plain" }).end("ok");
    return;
  }
  if (url.pathname !== "/mcp") {
    res.writeHead(404, cors).end();
    return;
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string" && key !== "origin") {
      headers.set(key, value);
    }
  }
  const response = await handler.fetch(
    new Request(url, {
      method: req.method,
      headers,
      body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
    }),
  );
  res.writeHead(response.status, {
    ...Object.fromEntries(response.headers),
    ...cors,
  });
  if (response.body) {
    for await (const chunk of response.body) {
      res.write(chunk);
    }
  }
  res.end();
}).listen(port, () => {
  console.log(`Card fixtures: http://localhost:${port}/mcp`);
  console.log(`Secure links point to ${origin}/checkouts/<runId>`);
  console.log(`runIds: ${[...runs.keys()].join(", ")}`);
});
