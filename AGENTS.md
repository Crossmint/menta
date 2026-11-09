# Agent instructions

Menta by Crossmint is a plugin that lets ChatGPT, Claude, Grok Bot and other MCP clients buy, book and order online at stores worldwide, through the MCP server at `/mcp` and the plugin in `plugins/menta`. It showcases Crossmint Agent Checkouts and Agent Cards. The signed-in web app lands on Home (`/home`: before anything happens, connecting an agent as the first step; then recent activity, connected agents and what's left to set up; on phones, Home is the app's menu and each page has a back arrow). The sidebar lists Home, Activity (`/activity`: purchases), the wallet (`/wallet`: cards, each with its details and spending limits) and Spending limits (`/spending-limits`, which users can also make there); its profile menu opens Settings (`/settings`: account, delivery addresses, agents, store sign-ins, notifications, language, support, log out and deleting the account, each section on its own page). The web chat at `/chat` is a place to try it, never the first thing users see. The web app is translated (`apps/web/lib/i18n`, English is the source); new user-facing strings go in the messages, in every language. Keep it small and real: live model, live Crossmint, no demo modes or ceremony layers.

## Read first

- `README.md`: what Menta is, goals and non-goals, setup. `docs/EDD.md`: how it fits together.
- `docs/HOSTS.md`: what each assistant host supports. `docs/ADDRESSES.md`: how saved addresses work. `docs/CREDENTIALS.md`: configuration.
- The UI in `apps/web` (home, activity, wallet, settings, chat, checkout dock, secure page) is the reference design. The logo (the leaf icon and wordmark, `apps/web/lib/brand.ts`) is Menta's, and the homepage sets the look every page shares: white pages, the hero's soft grey (`stage`), hairline cards (`panel`), grey insets (`well`), raised pill buttons, semibold tight headlines and the leaf's green as the only accent (`apps/web/app/style.css`). The in-host checkout card reuses its components (`packages/agent/src/ui`); keep new UI consistent with them.

## Ownership

Eve owns the agent loop, conversations and durable waits. Crossmint owns checkout runs, cards, payment authority and purchase history. Stytch owns login (and OAuth for MCP). This repo composes them. Don't add an order ledger, spending engine, checkout state machine or job runner; read state from Crossmint. Menta keeps only what Crossmint and Stytch have no field for: which agent started a checkout (`checkout_agents`, for Activity), the names users give their cards (`card_names`), which cards failed the card network's check and pay with the encrypted card (`card_setup`), and when each connected agent last used Menta and what it calls itself (`agent_use`, so Agents can tell two "ChatGPT" connections apart); the default card is Crossmint's.

## Hard rules

- The model can never approve, create or raise a spending limit (a Crossmint order intent). A spending limit is approved only through Crossmint's own UI inside our signed-in surfaces (the web chat dock, the secure page, the spending limit request page, or our in-host card, which only local dev draws). At a checkout's card payment, the user's assistant picks which of the user's approved limits pays (`spending_limits`, `pay_with_spending_limit`, `limit-payments.ts`): Menta's server checks that the limit is the user's and covers the payment under Crossmint's rule before answering, and a payment takes one answer (`paymentMessageId`). Nothing pays by itself. If no limit fits, the assistant asks for a generic one (`request_spending_limit`) or the user approves one in those surfaces. In the UI and in model text it is always a spending limit, never an order intent.
- Card numbers, CVCs, passwords and verification codes never go through chat, tools or logs. Protected store inputs use Crossmint's protected-input component.
- Keep capability URLs (e.g. the checkout live-view URL) and secrets out of model context; use `toModelOutput` to strip them.
- Derive the user from the verified Stytch session, never from caller input. The Stytch user ID is the Crossmint user (`x-crossmint-user-id` and the browser JWT `sub`).
- Never approve a real payment or spending limit while developing or testing unless the person paying has explicitly agreed to the exact item and price. Mind that an assistant can pay a checkout from one of the user's existing spending limits. Starting, reading and cancelling checkouts against Crossmint is fine for development.

## Conventions

TypeScript strict, pnpm workspaces, Biome, Vitest, Tailwind. Braces on every `if`. Validate external input with Zod at the edges; trust the Crossmint SDK types inside. Prefer deleting code to adding layers.

Commands: `pnpm dev`, `pnpm verify` (lint + types), `pnpm test`, `pnpm build`, `pnpm db:migrate`, `pnpm plugin:sync` (after changing the MCP server instructions, brand or origin).

Work on a short-lived branch; open a pull request when `pnpm verify` and `pnpm test` pass.

## Opus review loop

Every pull request an agent opens gets an independent Opus review before the agent hands it off. A loop has at most two rounds. A behavior change is any change to code, configuration or text a model reads (prompts, MCP server instructions, tool descriptions, `AGENTS.md`, skill files); other docs, code comments and tests aren't.

1. Full round. After opening the pull request, start a new subagent (not a fork, which would review with your assumptions) with model `opus` and effort `high`. Give it the pull request URL, its base branch and this section. It reviews the whole diff against this file, with the `code-review` skill at `high`, and runs `pnpm verify` and `pnpm test`. A finding is a problem it's confident in, not a style preference. It fixes each finding that needs no product or design decision, then commits and pushes to the pull request's branch only: no rebase, force-push, merge or other branch. Don't touch the branch while it runs.
2. Delta round. Only if the full round pushed a behavior change: start another new `opus` subagent at `high`, so no reviewer approves its own fix. Give it the head commit the full round started from. It reviews only `git diff <that commit>..HEAD` and the code that calls what changed, fixes what it finds under the same rules, and always ends the loop.
3. The round that ends the loop comments on the pull request with the full SHA of the head it leaves: `OPUS Review finished successfully (<sha>)` when nothing is open, or `OPUS Review failed (<sha>)` followed by each open finding and why. A finding that needs a decision stays open and names who decides. A behavior change the delta round made counts as open, since nobody reviewed it.

A later push of your own that changes behavior gets one delta round from the SHA in the last comment, not a new full round.
