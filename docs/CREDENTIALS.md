# Credentials

How to configure Menta and the provider dashboards it needs. All configuration lives in `apps/web/.env.local` locally (copy `apps/web/.env.example`, which marks the required variables) and in Vercel project settings when hosted. `pnpm dev` loads the file for both Next and the Eve agent. Never commit real values.

| Variable | Where it comes from |
| --- | --- |
| `OCA_WEB_ORIGIN` | The app's exact origin, no trailing slash, e.g. `http://localhost:3000` or `https://your-app.example` |
| `STYTCH_PROJECT_ID`, `STYTCH_SECRET`, `NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN` | Stytch Consumer project → API keys. `STYTCH_SECRET` also derives the keys that seal stored secrets, so keep it stable. The public token is optional and enables Google sign-in: add `{origin}/api/auth/google/callback` as a login and signup redirect URL. |
| `OCA_CODE_EMAIL_TEMPLATES` | Optional. Prefix of the Stytch custom HTML templates for the sign-in code email (`menta-code`); see "Sign-in code emails" below. Unset: Stytch's default email. |
| `DATABASE_URL` | Neon Postgres (the app uses Neon's serverless driver; Neon is also available through Vercel's Storage integration). Run `pnpm db:migrate`; on Vercel, `vercel-build` runs it. Locally, `pnpm dev` also stores Eve's Workflow state there (`scripts/dev-workflow-world.mjs`); Vercel keeps Eve's default Workflow world. |
| `OCA_DEV_WORKFLOW_WORLD` | Optional, local only. `postgres` (the default when `DATABASE_URL` is set) keeps conversations, including an interrupted turn, across `pnpm dev` restarts; `local` uses Eve's file-based world instead. Ignored on Vercel. `WORKFLOW_POSTGRES_URL`, `WORKFLOW_POSTGRES_WORKER_CONCURRENCY` and `WORKFLOW_POSTGRES_MAX_POOL_SIZE` override the Postgres world's defaults; `PORT` and `EVE_PORT` (3000 and 4357) change the dev ports. |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway. Deployments on Vercel can use OIDC instead. |
| `CROSSMINT_ENV` | `production` (default; Agent Checkouts is production-only) or `staging` |
| `CROSSMINT_{ENV}_SERVER_API_KEY` | Crossmint console → API keys. Scopes: `agent-checkouts.create/read/update/cancel`, `agent-checkouts.buyer-profiles.create/read/update/delete` (saved addresses) and `agent-checkouts.browser-profiles.create/read/delete` (store sign-ins). Without the profile scopes, addresses and store sign-ins fail with 403. |
| `CROSSMINT_{ENV}_CLIENT_API_KEY` | Client key for the browser components. Scopes: `payment-methods.create/read/update/delete` (delete: removing a card in Wallet; without it Crossmint answers 403), `order-intents.create/read/revoke` (revoke: a spending limit is revoked from Wallet or when the account is deleted), `protected-inputs.create`. Allow the app's origins. |
| `OCA_PUSH_PUBLIC_KEY`, `OCA_PUSH_PRIVATE_KEY` | Optional desktop Web Push. Generate once with `pnpm --filter @oca/agent exec web-push generate-vapid-keys`; keep the private key in environment settings, and keep the same pair across deployments. Requires migration 0009, `DATABASE_URL` and `STYTCH_SECRET`. Users opt in per browser on `/settings#notifications`. |
| `OCA_MCP_*` | Optional, for the MCP channel (Stytch Connected Apps). See below. |
| `OCA_MCP_EVENTS` | Optional. MCP Events (checkout notifications to ChatGPT Work chats) are on whenever `DATABASE_URL` and `STYTCH_SECRET` are set: subscriptions live in Neon (migration 0004) with their signing secrets sealed under a key derived from `STYTCH_SECRET`. Set to `off` to turn them off. |
| `OCA_GROK_BOT_UPDATES` | Optional. Grok Bot updates (pushes to the user's own Grok Bot routine webhook, set up on `/settings`) are on whenever `DATABASE_URL` and `STYTCH_SECRET` are set: routines live in Neon (migration 0006) with their keys sealed under a key derived from `STYTCH_SECRET`. Set to `off` to turn them off. |
| `OCA_GROK_BOT_WATCH` | Optional, off. `rearm` lets a Grok Bot updates follower hand over to a fresh function (`/api/grok-bot/watch`) for up to 30 minutes per checkout, so changes long after the last read still reach the routine. Costs function time while a checkout is watched (EDD "Grok Bot updates"). On preview deployments with Vercel deployment protection the self-request is refused. |
| `OCA_MCP_CARD_TOKEN_*` | Optional: payment approval and private store fields inside the ChatGPT/Claude checkout card, and the assistant's `spending_limits` and `pay_with_spending_limit` tools (`packages/agent/src/limit-payments.ts`), in the MCP server and the web chat. Set, an assistant can pay for real from the user's approved limits. See "Secure step in the card" below. |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Optional. PostHog project → Project API key (`phc_…`, public) and ingestion host (default `https://us.i.posthog.com`; EU projects use `https://eu.i.posthog.com`). Set, the web app asks each visitor for analytics-cookie consent (`app/_components/cookie-banner.tsx`) and, only after they accept, sends pageviews and clicks (`apps/web/lib/client/analytics.ts`), with clicked text masked and session replay off. Read at build time, so redeploy after changing them. |
| `OPENAI_APPS_CHALLENGE` | Optional. The domain verification token from ChatGPT's plugin dashboard (platform.openai.com/plugins), served as plain text at `/.well-known/openai-apps-challenge`. Unset: that path is a 404. |
| `OCA_TEST_DATABASE_URL` | Optional, tests only. The database tests (`*.db.test.ts`) run against it and are skipped without it. Use a throwaway database, never production. |

Crossmint's project must accept Stytch session JWTs: Console → API keys → JWT authentication → 3P provider Stytch, with your Stytch project. The Stytch user ID is the Crossmint user.

Local sign-in with a Stytch test project: use `sandbox@stytch.com` and code `000000`. Sandbox sessions are static, so they can't approve an assistant on `/oauth/authorize` (Stytch answers `session_not_found`); sign in with a real email or Google for that.

## Sign-in code emails

Email sign-in sends a 6-digit code. By default Stytch sends its own email, in English, Spanish, French or Brazilian Portuguese to match the visitor (their language on the site, else the browser's). With Stytch's custom email add-on and a verified sender domain, Menta's own email goes out in every app language instead:

1. Print the emails: `node scripts/code-emails.mjs https://your-origin`. Their text is `auth.codeEmail` in the app's messages, so a wording change is a messages change plus a re-upload.
2. In Stytch (Branding → Emails), for each language create two **Custom HTML** templates, **One-time passcodes**, one per action, with IDs `{prefix}-login-{locale}` and `{prefix}-signup-{locale}` (e.g. `menta-code-login-de`), and paste that language's `subject`, `html` and `text`. Set the sender on each, on the app's own domain (e.g. `menta.crossmint.com`): iOS has been seen to skip offering a code from Mail when the sender's domain differs from the site's.
3. Set `OCA_CODE_EMAIL_TEMPLATES` to the prefix (`menta-code`). A missing template fails the code request, so create every language first.

## MCP (ChatGPT, Claude, Grok, Codex) via Stytch Connected Apps

Assistants connect to `{OCA_WEB_ORIGIN}/mcp` (shown on `/connect`; locally `http://localhost:3000/mcp`). An unauthenticated call gets `401` pointing at `{OCA_WEB_ORIGIN}/.well-known/oauth-protected-resource/mcp`, which names the Stytch project domain as the authorization server. The assistant reads Stytch's `/.well-known/oauth-authorization-server`, registers itself (Dynamic Client Registration or a client ID metadata document), sends the user to our consent page, and calls `/mcp` with a Stytch access token. Its subject is the same Stytch user ID as on the web, so it acts as the same Crossmint user. The model never approves payments: Menta's server pays from a spending limit the user approved when one covers the total, and otherwise the user approves one in Crossmint's UI inside the checkout card (below) or on the secure page the tools link to.

| Variable | Value |
| --- | --- |
| `OCA_MCP_AUTHORIZATION_SERVER_URL` | Required for OAuth. The Stytch project domain, e.g. `https://<slug>.customers.stytch.com` (test: `.customers.stytch.dev`), or the custom auth domain if one is set up. HTTPS, no path. It is advertised as the authorization server, is the expected token `iss`, and the server SDK fetches signing keys from it. Unset: every OAuth token is rejected. |
| `OCA_MCP_SCOPES` | Optional, default `commerce:invoke`. Space-separated; every listed scope is advertised and required on each token. |
| `OCA_MCP_MAX_TOKEN_LIFETIME_SECONDS` | Optional, default `28800`. At least Stytch's access-token lifetime (8 hours for Connected Apps; not configurable in the dashboard). Tokens are verified locally, so a disconnected assistant's current token keeps working until it expires; this caps that window. |

The resource identifier is derived: `{OCA_WEB_ORIGIN}/mcp`. It must be HTTPS, except `http://localhost`/`127.0.0.1` outside production builds for local clients such as Codex.

Stytch dashboard (Consumer project, same one as web login), per environment:

1. **Connected Apps → Settings**
   - Authorization URL: `{OCA_WEB_ORIGIN}/oauth/authorize` (our consent page).
   - Enable **Dynamic Client Registration** (Grok, Codex and others register themselves) and keep **client ID metadata documents** on. With both on, Stytch advertises `client_id_metadata_document_supported` and the `none` auth method, so ChatGPT and Claude connect with their CIMD URLs (`https://chatgpt.com/oauth/client.json`, a claude.ai document). Host detection handles both kinds of client (docs/HOSTS.md, "Host detection"). Turning CIMD off only sends them back to DCR.
2. **RBAC policy** (Management → RBAC): a resource `commerce` with an `invoke` action, a custom scope `commerce:invoke` granting it, and that permission on the default `stytch_user` role. Users can only grant scopes their roles allow; the consent page warns when one can't be granted.
3. **Domains**: a custom auth domain is recommended by Stytch for Connected Apps. If one is added, use it for `OCA_MCP_AUTHORIZATION_SERVER_URL`, since it becomes the token issuer.

What to check once it is configured:

- `curl -i -X POST {OCA_WEB_ORIGIN}/mcp` returns `401` with `WWW-Authenticate: Bearer resource_metadata="{OCA_WEB_ORIGIN}/.well-known/oauth-protected-resource/mcp", scope="commerce:invoke"`, and that URL returns the resource, the Stytch domain and `commerce:invoke`.
- `{OCA_MCP_AUTHORIZATION_SERVER_URL}/.well-known/oauth-authorization-server` lists a `registration_endpoint` and `commerce:invoke`.
- `{OCA_WEB_ORIGIN}/.well-known/oauth-protected-resource` (the root fallback MCP clients try) returns the same document.
- The consent page calls Stytch through `OCA_MCP_AUTHORIZATION_SERVER_URL`, not the default `test.stytch.com`/`api.stytch.com` host: Stytch stamps the redirect's RFC 9207 `iss` with the domain it was called on, and assistants reject anything but the advertised issuer ("OAuth issuer mismatch … stytch.com/project-…").
- The access token's `aud` must contain both the project ID and `{OCA_WEB_ORIGIN}/mcp`, and `iss` must equal `OCA_MCP_AUTHORIZATION_SERVER_URL`. The consent page passes the client's RFC 8707 `resource` to Stytch's authorize call (`resources`); Stytch's docs don't say whether that becomes `aud`. If tokens arrive without it, every MCP call returns `401`: decode one token to confirm before loosening the check.

Local development without OAuth: under `pnpm dev` with a loopback `OCA_WEB_ORIGIN`, `/mcp` also accepts the signed-in user's Stytch session token (the `oca_session` cookie value) as the Bearer, for MCP clients and scripts. Production builds, Vercel and non-loopback origins never accept it.

## Secure step in the card (Stytch Trusted Auth Tokens)

Crossmint's payment authorization and protected inputs run inside the ChatGPT/Claude checkout card when these are set and the host allows Crossmint's frames; otherwise the card links to the secure page. The card needs a Stytch session JWT for the MCP user (Crossmint trusts those; a Connected Apps access token isn't one), which the server mints through a Trusted Auth Token profile that trusts our own signing key.

| Variable | Value |
| --- | --- |
| `OCA_MCP_CARD_TOKEN_PROFILE_ID` | The Trusted Auth Token profile ID, `trusted-token-profile-test-…` or `trusted-token-profile-live-…`. |
| `OCA_MCP_CARD_TOKEN_PRIVATE_KEY` | RSA private key, PKCS#8 PEM (`-----BEGIN PRIVATE KEY-----`), newlines as `\n` on one line. One key per environment; never committed. Its public half goes on the Stytch profile. |

Either one unset or malformed turns the feature off (the card links out); nothing else changes. Uses the same `STYTCH_PROJECT_ID`/`STYTCH_SECRET` and Crossmint client key as the web.

Generate a key pair (keep the private key in `.env.local` or Vercel only):

```sh
node -e 'const {generateKeyPairSync}=require("crypto");const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048});console.log(publicKey.export({type:"spki",format:"pem"}));console.log("OCA_MCP_CARD_TOKEN_PRIVATE_KEY=\""+privateKey.export({type:"pkcs8",format:"pem"}).trim().replaceAll("\n","\\n")+"\"")'
```

Stytch dashboard (Consumer project; the test project for local, the live one for production) → **Trusted Auth Tokens** → **Create profile**:

1. **Issuer**: `{OCA_WEB_ORIGIN}` exactly (e.g. `https://menta.crossmint.com`; locally `http://localhost:3000`).
2. **Audience**: `{OCA_WEB_ORIGIN}/mcp/card`.
3. **Public key**: choose "Use public keys instead" in the JWKS URL row and paste the PEM public key.
4. **Attribute mapping**: `email` → `email`, `token_id` → `jti`. Leave `external_user_id` and roles unmapped.
5. **Allow JIT Provisioning**: off (an assertion must only ever sign in an existing user).
6. Save, copy the profile ID into `OCA_MCP_CARD_TOKEN_PROFILE_ID`.

Each mint signs a 60-second assertion for the MCP user's verified email, attests it into a 5-minute session (Stytch's minimum, not extendable), and is discarded (and the session revoked) unless Stytch resolved the same user ID.

Crossmint console (the project whose client key `CROSSMINT_{ENV}_CLIENT_API_KEY` is; nothing new on the server key): **API keys → client key → Authorized origins**, add each card origin exactly. Crossmint's frames call Crossmint same-origin, but the order-intent calls our card list makes come from the card's own origin.

- Claude: `https://{first 32 hex of sha256("{OCA_WEB_ORIGIN}/mcp")}.claudemcpcontent.com`, the same value the server sends Claude as `ui.domain`. For example, the menta.crossmint.com deployment (`https://menta.crossmint.com/mcp`) uses `https://2343e9f834055179495cddc3314465a9.claudemcpcontent.com`; yours will differ. Add exactly that URL, no trailing slash. Compute others with `node -e 'console.log(require("crypto").createHash("sha256").update(process.argv[1]).digest("hex").slice(0,32)+".claudemcpcontent.com")' https://host/mcp`. Claude only serves https connectors, so local dev has none.
- ChatGPT: `https://<derived>.web-sandbox.oaiusercontent.com`, which ChatGPT derives from `openai/widgetDomain` (our origin): so far the host with dots turned into dashes, e.g. `https://menta-crossmint-com.web-sandbox.oaiusercontent.com`. Confirm it once from the logs (`Card secure step requested from https://…`) or the `Origin` header of the card's requests in ChatGPT's dev tools, then add it.
- Keep the web origins (`http://localhost:3000`, the production origin) as they are.

Also confirm the client key has `order-intents.create/read/revoke`, `payment-methods.create/read/update` and `protected-inputs.create` (already needed by the web), and that the project's JWT authentication accepts the Stytch project the card's sessions come from (3P provider Stytch with the matching Stytch project for each environment).

## Moving to a new origin

Everything below follows `OCA_WEB_ORIGIN`, so a domain move touches each of them. Add the new values next to the old ones first, switch, then redirect the old domain. The official deployment moved from `https://oca.dev` to `https://menta.crossmint.com` this way.

1. Hosting: attach the new domain, set `OCA_WEB_ORIGIN`, redeploy.
2. Stytch redirect URLs: `{origin}/api/auth/google/callback` for login and signup, made the default. Email sign-in uses codes and needs no redirect URL. The Google OAuth client itself only redirects to Stytch, so it doesn't change.
3. Stytch Connected Apps → Settings → Authorization URL: `{origin}/oauth/authorize`.
4. Stytch Trusted Auth Tokens: a profile with issuer `{origin}` and audience `{origin}/mcp/card` (a second profile with the same public key lets you switch by changing `OCA_MCP_CARD_TOKEN_PROFILE_ID`).
5. Crossmint client key → Authorized origins: the new origin, its Claude card origin and its ChatGPT card origin (see above).

Connectors added under the old `{origin}/mcp` stop working after the switch (tokens carry the old resource) and must be added again with the new URL. Web sessions are per domain, so users sign in once more.
