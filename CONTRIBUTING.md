# Contributing

Thanks for helping with Menta. Bug reports, fixes and small improvements are welcome.

## Setup

Follow the [README](README.md): Node 24.15, pnpm 10.34, `pnpm install`, `apps/web/.env.local` from `apps/web/.env.example`, `pnpm db:migrate`, `pnpm dev`. [docs/CREDENTIALS.md](docs/CREDENTIALS.md) covers the provider accounts. Read [docs/EDD.md](docs/EDD.md) before larger changes.

## Pull requests

- Keep each PR small and focused on one change, with a short description of what and why.
- Run `pnpm verify` (Biome lint and format, package builds, TypeScript) and `pnpm test` before opening it. CI runs both.
- Follow the existing style: TypeScript strict, Biome formatting, braces on every `if`, Zod validation at the edges. Prefer deleting code to adding layers.
- If you change the MCP server instructions, brand or origin, run `pnpm plugin:sync` and commit the regenerated `plugins/menta` files.
- Update the docs when behavior changes.

## Rules that are never relaxed

- The model can never approve a payment. Approval happens only in Crossmint's UI inside Menta's signed-in surfaces, through a path no model tool can call.
- Card numbers, CVCs, passwords and verification codes never go through chat, tools or logs. Protected store inputs use Crossmint's protected-input component.
- Capability URLs (such as a checkout's live view) and secrets stay out of model context.
- The user is derived from the verified session or token, never from caller input.
- Don't add an order ledger, spending engine, checkout state machine or job runner; read state from Crossmint.
- Agent Checkouts runs real checkouts. Cancel test runs before payment, and never approve a real payment you haven't agreed to.

## Security issues

Don't open a public issue for a vulnerability. Report it as described in [SECURITY.md](SECURITY.md).

## Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](LICENSE).
