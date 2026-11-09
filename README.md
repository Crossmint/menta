# Menta

Menta by Crossmint is a plugin that lets your AI assistant buy, book and order online, at stores around the world. Tell it what you want and a price limit; a Crossmint browser agent runs the checkout at the store, asks you when the store needs an answer, and stops for your approval before any payment. Payments are approved only by you, in Crossmint's UI. The model never can. Menta is open source and a working showcase of [Crossmint Agent Checkouts](https://docs.crossmint.com/agents/agent-checkouts-quickstart) and Agent Cards.

Hosted at [menta.crossmint.com](https://menta.crossmint.com).

## Where it runs

- **Web app**: after sign-in, `/home` (connecting an agent first; then recent activity, connected agents and what's left to set up; on phones, the app's menu), `/activity` (every purchase, from any assistant), `/wallet` (saved cards, each with its name, default, security code and the spending limits on it), `/spending-limits` (the spending limits, or order intents, the user's cards have paid under; a user can make one there, or from a card's details, with an amount, a name, an optional store and when it expires) and `/settings` (account, delivery addresses, agents, store sign-ins, notifications, language, and deleting the account, each section on its own page). `/install` redirects to `/home`; `/transactions`, `/addresses` and `/connections` redirect to their new pages. Translated into 16 languages (`apps/web/lib/i18n`).
- **Web chat** at `/chat`: a place to try Menta's own agent, built on [Eve](https://github.com/vercel/eve), with a checkout dock above the composer.
- **ChatGPT and Claude**: an MCP server at `/mcp` (OAuth via Stytch). The host's model finds the item; Menta buys it. The assistant asks the store's questions in chat and links to Menta for the rest: the spending limit request page for a payment, the secure page for private details. For a checkout in progress, the user asks the assistant. Menta's in-host checkout card is drawn only in local development: ChatGPT, Claude and every other MCP client (Cursor, Codex, Grok Bot and the rest) get these links.
- **Grok Bot**, Codex, Claude Code, Cursor and other MCP clients: the same MCP server, with text results, native forms where the client supports them, and a link to Menta's secure page for payment.
- **Plugin**: `plugins/menta` packages the MCP server with `setup` and `buy` skills for ChatGPT, Codex, Claude, Cursor and Grok Bot.

`/` is the public homepage, with one URL per language (`/es`, `/ja`…). [docs/HOSTS.md](docs/HOSTS.md) covers what each host supports.

## Goals and non-goals

Goals:

- Delegate a real checkout from any assistant and finish it with the user in the loop: store questions, private details and payment approval.
- The same user, cards, addresses and memory on every surface. The web and MCP paths resolve to one Stytch user, which is the Crossmint user.
- Two reusable Eve extensions for Agent Checkouts and Agent Cards that other agents can mount on their own.

Non-goals:

- Our own order ledger, spending rules, checkout state machine or job runner. Crossmint is the source of truth for checkouts, cards, payment authority and purchase history.
- Competing with general assistants. Conversation quality comes from the model; Menta adds the ability to buy.

## How it uses Crossmint

- **Agent Checkouts** runs each checkout: a browser agent opens the store, shops and checks out, never spending above the limit. Menta starts, reads, answers, steers and cancels runs; it keeps no checkout state of its own.
- **Agent Cards** saves the user's cards. Card entry is Crossmint's own form (`CrossmintPaymentMethodManagement`); Menta only ever sees a card's brand, last four and expiry.
- **Spending limits** (Crossmint order intents) carry payment approval. The user picks a card and approves a limit in Crossmint's UI (with verification or CVC when the card rail asks). When a checkout asks for a card payment, the user's assistant picks the limit that fits what the purchase is for and Menta pays with it after checking it covers the payment (`packages/agent/src/limit-payments.ts`); with none that fits, the assistant asks for a generic one or the user approves one there, and its `orderIntentId` goes to the run. An assistant can also ask for a limit ahead of time (`request_spending_limit`): the user approves it on a Menta page whose link is sealed for them and works for 24 hours. The card network's check runs on the limit being approved; if it fails, the limit pays with Crossmint's encrypted card.
- **Protected inputs** handle store passwords and codes. Crossmint's `CrossmintProtectedInput` returns a reference, never the value.
- Crossmint trusts Stytch session JWTs, so browser components act as the signed-in user.

## Security model

- The model can't approve, create or raise a spending limit, or pick one to pay with. Approval happens only in Crossmint's UI inside Menta's signed-in surfaces (the web chat dock, the secure page `/checkouts/[runId]`, the spending limit request page, or the in-host card, drawn only in local development), through paths no model tool can call.
- Card numbers, CVCs, passwords and verification codes never pass through chat, tools or logs.
- Capability URLs (such as a checkout's live view) and credentials stay out of model context.
- The user is always derived from the verified session or OAuth token, never from tool arguments.

See [SECURITY.md](SECURITY.md) to report a vulnerability.

## Prerequisites

- Node 24.15 and pnpm 10.34.
- A **Crossmint** production project (Agent Checkouts is production-only) with a server key, a client key, and JWT authentication set to trust your Stytch project.
- A **Stytch** Consumer project for login, with Connected Apps enabled for MCP clients.
- **Neon** Postgres (the app uses Neon's serverless driver), as `DATABASE_URL`.
- **Vercel AI Gateway** for the model.

[docs/CREDENTIALS.md](docs/CREDENTIALS.md) lists every variable and the dashboard settings.

## Quick start

```sh
pnpm install
cp apps/web/.env.example apps/web/.env.local   # fill it in, see docs/CREDENTIALS.md
pnpm db:migrate
pnpm dev
```

Open http://localhost:3000 for the homepage and http://localhost:3000/chat for the chat. With a Stytch test project you can sign in as `sandbox@stytch.com` with code `000000`. Local MCP clients connect to http://localhost:3000/mcp.

Checkouts are real: they run against live stores. Cancel a run before payment if you're only trying it out.

## Deploying to Vercel

1. Import the repo with `apps/web` as the root directory. Its `vercel-build` script runs the database migrations, then builds.
2. Set the environment variables from `apps/web/.env.example`, with `OCA_WEB_ORIGIN` set to the deployment's exact origin. On Vercel the AI Gateway can use OIDC instead of `AI_GATEWAY_API_KEY`.
3. Add the origin in Stytch (redirect URLs, Connected Apps authorization URL `{origin}/oauth/authorize`) and in Crossmint (the client key's authorized origins).

Details for each step are in [docs/CREDENTIALS.md](docs/CREDENTIALS.md).

## Forking

The official plugin in `plugins/menta` points at https://menta.crossmint.com. For your own deployment, change `PRODUCTION_ORIGIN` in `apps/web/lib/site.ts` to your origin and `PRODUCTION_AUTHORIZATION_SERVER` to your `OCA_MCP_AUTHORIZATION_SERVER_URL`, then run `pnpm plugin:sync` so the plugin files point at your server. Forks may not present themselves as Crossmint or Menta by Crossmint; see [NOTICE](NOTICE).

## Project layout

```text
apps/web/                          Next.js app: homepage, chat, secure checkout page, settings, MCP server route, OAuth consent
packages/agent/                    the Eve agent, MCP server, in-host checkout card and shared checkout UI
packages/crossmint-agent-checkouts/  reusable Eve extension for Crossmint Agent Checkouts
packages/crossmint-agent-cards/      reusable Eve extension for Crossmint Agent Cards
plugins/menta/                       installable plugin for ChatGPT, Codex, Claude, Cursor and Grok Bot
migrations/                        Neon Postgres migrations (run by pnpm db:migrate)
scripts/                           dev server, migrations and plugin sync
docs/                              design and setup docs
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Builds the packages and runs the web app and agent at http://localhost:3000 |
| `pnpm verify` | Biome lint and format check, package builds, TypeScript |
| `pnpm test` | Vitest unit and contract tests |
| `pnpm build` | Production build of the web app |
| `pnpm db:migrate` | Applies `migrations/` to `DATABASE_URL` |
| `pnpm plugin:sync` | Regenerates the plugin files in `plugins/menta` |
| `pnpm card:fixtures` | Serves the MCP server over fake checkouts in every state, for testing the in-host card |

## Docs

- [docs/EDD.md](docs/EDD.md): architecture and request flows.
- [docs/HOSTS.md](docs/HOSTS.md): what each assistant host supports and how Menta behaves there.
- [docs/ADDRESSES.md](docs/ADDRESSES.md): how saved addresses work in checkouts.
- [docs/CREDENTIALS.md](docs/CREDENTIALS.md): configuration and provider setup.
- [plugins/menta/README.md](plugins/menta/README.md): installing the plugin locally.
- [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

[Apache-2.0](LICENSE). Third-party notices and trademarks are in [NOTICE](NOTICE).
