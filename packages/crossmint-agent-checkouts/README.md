# @oca/crossmint-agent-checkouts

A reusable [Eve](https://github.com/vercel/eve) extension for [Crossmint Agent Checkouts](https://docs.crossmint.com/agents/agent-checkouts-quickstart). It gives an agent tools to start, follow, answer, steer and cancel checkout runs as the signed-in user, plus saved addresses (Crossmint buyer profiles) and store sign-ins (one browser profile per user). Crossmint holds all checkout state; the extension keeps none.

The model never sees live-view URLs, progress, card data or protected values, and no tool can approve a payment. Payment and protected store inputs go to the `actionUrl` page you provide, where the user completes them in Crossmint's UI.

## Mount it

Mount it as `checkouts` in your agent's `agent/extensions/checkouts.ts` (the tool descriptions refer to each other as `checkouts__*`):

```ts
import { createCrossmintSdk } from "@crossmint/rest-js";
import checkouts from "@oca/crossmint-agent-checkouts";
import { type Checkouts, createCheckouts } from "@oca/crossmint-agent-checkouts/checkouts";

let service: Checkouts | undefined;

export default checkouts({
  // Called per tool call, so keys are read at runtime, not at build.
  checkouts: () =>
    (service ??= createCheckouts({
      api: createCrossmintSdk({
        environment: "production",
        apiKey: process.env.CROSSMINT_PRODUCTION_SERVER_API_KEY!,
      }).agentCheckouts,
      actionUrl: (runId) => `https://your-app.example/checkouts/${runId}`,
    })),
  // The Crossmint user for a verified Eve session; null means signed out.
  userId: (auth) => (auth?.authenticator === "stytch" ? auth.subject : null),
});
```

`userId` must come from a verified session. It becomes `x-crossmint-user-id` on server-key calls, and should match the `sub` of the JWT your browser components use with Crossmint.

`createCheckouts` options: `api` (the SDK's `agentCheckouts`), `actionUrl`, and optionally `buyerProfiles` (default `true`), `browserProfiles` (default `true`) and `addressDefaults` (`get`/`set` of the user's default buyer profile ID; Crossmint has no default flag, so you store it).

## Tools

| Tool | What it does |
| --- | --- |
| `create` | Starts a checkout (`startUrl`, `task`, `maxCost`, `fulfillment`, `deliverTo`, `addressLabel`, `country`). Returns the run, or `needs_address` / `which_address` when it can't pick an address. |
| `get`, `list` | Read one run or the user's runs. |
| `answer` | Answers the store's ordinary question, or sends `instead` in the user's words. Refuses payment and protected fields. |
| `steer` | Sends a running checkout a plain instruction. |
| `cancel` | Asks Crossmint to cancel a run. |
| `addresses` | Reads the user's saved addresses, with a `next` line: use the default, ask which one, or ask for a new one. |
| `save_address` | Saves an address the user gave in chat, or changes one by `id`. |
| `delete_address` | Deletes one by `id`. |
| `set_default_address` | Makes one of the user's own places the default, or none. |

Tool descriptions tell the model to call `watch` after starting or answering. That tool is yours to provide, for example an Eve task that polls the run until it needs the user or ends (see `packages/agent/agent/tools/watch_checkout.ts`).

## Other exports

- `@oca/crossmint-agent-checkouts/checkouts`: `createCheckouts` and the `Checkouts` service your server routes can call directly (`get`, `list`, `respond` with answers or an `orderIntentId`, `steer`, `cancel`, address and sign-in methods), plus `forModel` (strips capability URLs and progress), `planShipping` and view types.
- `@oca/crossmint-agent-checkouts/tools`: each tool definition, to wrap or override in your own agent.
- `@oca/crossmint-agent-checkouts/address-chat`: the address tools' inputs, descriptions and helpers, to give another agent (an MCP server) the same tools under its own names.
- `@oca/crossmint-agent-checkouts/address-draft`, `/address-labels`, `/secret-fields`: validation and labels shared by address forms, and the check for questions that ask for a secret.

How addresses are chosen is in [docs/ADDRESSES.md](../../docs/ADDRESSES.md).

## Build and test

```sh
pnpm --filter @oca/crossmint-agent-checkouts build
pnpm test
```

The unit tests use fakes and never create live runs. Agent Checkouts is production-only, so any run you start against Crossmint is real.
