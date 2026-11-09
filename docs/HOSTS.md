# Hosts

What each assistant host can do for Menta and what the user gets there. The capability matrix was checked against primary docs in October 2026 ([sources](#sources)); "unverified" means no primary source says it either way. Host behavior changes often, so re-check a cell before building on it.

Our web chat (`apps/web`: chat, checkout dock, secure page, `/settings`) is the reference. Every other host gets the closest version of it that host allows, with the secure page `/checkouts/[runId]` as the floor everywhere. ChatGPT and Claude no longer get Menta's in-host checkout card (and ChatGPT no longer gets Menta's plugin settings): like text clients, they get the secure page for private details and the spending limit request page for payments. Neither does any other client, even one that declares MCP Apps (Cursor, VS Code). The card and settings code stays: only the local dev host (`local`) gets them. [EDD.md](EDD.md) ("MCP flow") describes how the MCP server implements this.

## Capability matrix

✅ documented · ❌ documented as unsupported · — not applicable · ? unverified. Brackets cite [sources](#sources).

### ChatGPT

| Surface | Card (MCP Apps, `ui.resourceUri` / `openai/outputTemplate`) | App-only tools | Rich forms (OpenAI form elicitation) | Standard elicitation | MCP Events | Display modes | Links and popups from the card | OAuth | Plans |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Chat, web | ✅ [O4][L1] | ✅ `ui.visibility: ["app"]`, `openai/visibility: private` [O5] | ❌ at launch ("classic ChatGPT is excluded") [O2]; Free/Go "coming soon" [O1] | ? | ❌ [O3] | inline, fullscreen [O2] | `openExternal` to `redirect_domains` [O5]; popups ? | CIMD (preferred), DCR, predefined [O6][O8] | Plugins in Chat on all plans [L1]; custom MCP plan rules ? [H1] |
| Chat, desktop app | ✅ [L1] | ✅ [O5] | ✅ Desktop [O2] (whether that includes Chat mode or only Work ?) | ? | ❌ [O3] | inline, fullscreen [O2] | as web; popups ? | as web | as web |
| Chat, iOS / Android | ✅ for published plugins [O9]; custom MCP apps "web only" [H1] | ✅ [O5] | ❌ [O2] | ? | ❌ [O3] | "On mobile, picture-in-picture may be presented as fullscreen" [O5] | `ui/message` active or new conversation, sent or as a draft; no resource links on iOS [O2]; popups ? | as web | as web |
| Work Cloud (web; desktop with Cloud) | ✅ (Web column = Work browser) [O2] | ✅ | ✅ [O2]; needs MRTR on `2026-07-28` for OpenAI-registered servers [O1][O2] | ✅ through MRTR [O2] | ✅ [O3] | inline, fullscreen; entrypoints open fullscreen [O2] | as web | as web | Work on Free, Go, Plus, Pro, Business, Edu, Enterprise [L5]; extensions for Free/Go web "coming soon" [O1] |
| Work Local (desktop) | ✅ Desktop [O2] | ✅ | ✅ Desktop [O2] | ✅ | ❌ ("with **Cloud** selected") [O3] | inline, fullscreen | as web | as web | as Work; local work "when enabled" [L2] |
| dots | ? | ? | ? | ? | ✅ [O3] | ? | ? | plugin connections [L3] | Pro 100/200/500 (18+, outside EEA/UK/CH), Business Premium, Enterprise (admin enables) [L3]; created on desktop, used on mobile app, no mobile web [L3] |
| Codex in the desktop app | ❌ for UI: "optional UI in ChatGPT", tools must work without UI [O4] (?) | — | ✅ `mode: "openai/form"` [L7] | ✅ form and url [L7] | ❌ | — | url elicitation opens a browser [L7] | CIMD, DCR [L6] | Plugins in Codex [L1] |
| Codex CLI | ❌ | — | ✅ opt-in `mcpServerOpenaiFormElicitation` [L7] | ✅ when `approval_policy.granular.mcp_elicitations` allows; otherwise auto-rejected [L8] | ❌ | — | url mode [L7] | CIMD, DCR [L6] | some plugins unavailable with API-key sign-in [L1] |

ChatGPT extension platforms [O2] (re-checked 2026-10-29, spec 0.2.1): sidebar app (global entrypoint), conversation panel (thread entrypoint), structured settings, display modes and plugin onboarding work on Desktop, Web (Work), iOS and Android. Deep links work everywhere except Android. Composer mentions work on Desktop and Web (Work); file entrypoints, file resources and WebMCP app tools are Desktop only. Forms are Desktop and Web (Work) only, and can continue across several rounds. `ui/message` can open a new conversation or leave an editable draft (`send: false`) on every platform, though iOS can't send resource links. Model-context thumbnails don't work on iOS yet.

### Claude and other MCP clients

| Host | Card (MCP Apps) | App-only tools | Elicitation | Events / push | Display modes | Links and popups | OAuth | Plans |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| claude.ai web | ✅ [M3][C2] | spec MUST [M4]; not stated in Claude's docs ? | not documented; "Advanced or draft capabilities" unsupported [C1] → treat as ❌ ? | ❌ none documented | inline, fullscreen; spec also lists `pip` [C2] (pip ?) | `ui/open-link` shows a confirm modal; directory connectors can allowlist "Allowed link URIs" [C3]; `frameDomains` restricted [C2]; popups ? | DCR by default; CIMD when the server advertises `client_id_metadata_document_supported` and `none` [C5] | custom connector by URL: Free (one), Pro, Max, Team, Enterprise; an Owner adds it on Team and Enterprise [C6] |
| Claude desktop | ✅ [M3] | as web | as web | ❌ | as web | as web | as web | as web |
| Claude iOS / Android | ✅ in WKWebView / WebView; add the connector on web or desktop first [C2] | as web | as web | ❌ | fullscreen fills the screen with chat input overlaid [C2] | iOS omits `Referer`; allow by `Origin` `*.claudemcpcontent.com` [C4] | as web | as web |
| Claude Code | not documented ? | — | ✅ form and url [C7] | channels only: local stdio, research preview, not on `2026-07-28` [C7][C8] → ❌ for us | — | url mode opens the browser [C7] | DCR, CIMD [C7] | uses claude.ai connectors [C7] |
| Cursor | ✅ [X1][M3] | ? | ✅ [X1] | ? | ? | ? | OAuth with DCR or static client [X1] | ? |
| VS Code Copilot | ✅ [M3] | ? | ? | ? | ? | ? | ? | ? |
| Grok (grok.com) | not documented ? | — | not documented ? | ❌ | — | — | "complete any required authentication" [X2] | ? |
| Grok Bot (xAI desktop agent; clientInfo `Cursor`, `2025-11-25`) | ❌ (now declares `io.modelcontextprotocol/ui` but never reads the card resource) | — | declares `elicitation` (2025-era: we send no forms); asks store questions with its own picker | ❌ (no MCP Events); push through the user's own routine webhook ("Grok Bot updates") | — | links to the secure page (`via=grok`) | OAuth via Cursor's hosted backend ✅ | Cursor Marketplace |
| Gemini CLI | not documented | — | not documented | ❌ | — | — | OAuth discovery with DCR [X3] | — |
| Gemini app | ? (no primary source found) | | | | | | | |

Hard limits that shape the flow: Claude's hosted tool call timeout is 240 s [C1]. Claude's tool results are capped at about 150,000 characters [C1]. ChatGPT treats tools without `readOnlyHint` as writes and asks for confirmation [O8].

### Host notes

- **Menta doesn't use ChatGPT's own forms; the model asks in chat.** OpenAI lists form elicitation as Desktop and Web (Work) only [O2], and over MRTR the schema must go in `_meta["openai/elicitation"].requestedSchema` beside an empty core schema or it is reported unsupported. Tested 2026-10-29: Work on the web declared `elicitation: { form, url }` on the model's calls (`openai/elicitation.form` only on the card's own calls) and declined our form at once, unseen. In the desktop app (client `openai-mcp/1.0.0 (Codex)`), Chat declares no elicitation; Work declares `openai/elicitation.form` and, with the chat on "Ask for approval", shows the form (options, "Or write your own response", Deny/Accept) and chains question to question, but with Full access it accepts every form at once with empty content, never shown. That spread is why ChatGPT gets no forms: the model asks the store's questions in chat.
- **MCP Events only reach Work chats on web, Work Cloud on desktop, and dots** [O3]. A subscription starts when the user asks ChatGPT to monitor something; it does not start on its own.
- **ChatGPT does not support `pip`** [O2]. The card (local dev only now) offers only the display modes the host lists.
- **ChatGPT shows `ui/update-model-context` blocks as removable composer attachments** unless they are marked `annotations.audience: ["assistant"]` [O2]. The card marks its notes that way.
- **ChatGPT caches MCP Apps views by URI**, so the card is served at a versioned URI. After a deploy, "Refresh tools" in the plugin page picks up new tools.
- **ChatGPT Chat (not Work) asks before each tool call** ("Allow once" or Deny), including read-only waits.
- **Claude has no documented elicitation on claude.ai, desktop or mobile** [C1]. Claude Code supports form and URL elicitation [C7]. Claude renders MCP Apps on web, desktop, iOS and Android, but `frameDomains` is "restricted in Claude pending security review" [C2].
- **The plugin declares its OAuth in `mcp.json`.** OpenAI's ZIP upload refuses a package whose MCP server has no `extensions["com.openai"].auth`, then asks for `authorizationUrl` and `tokenUrl` too, although its docs say to omit endpoints discovery supplies [O10]. Menta declares CIMD with Stytch's two endpoints (`openAiMcp` in `apps/web/lib/plugin.ts`). Codex's plugin loader rejects a server entry with `extensions` ("unknown field `extensions`") and drops the server [G1]. That doesn't reach Menta: Codex CLI 0.142 takes the server from the package's plain `.mcp.json`. It lists Menta's server from the 0.1.1 package, and none from a copy with only `mcp.json`, with or without `extensions`. Keep `.mcp.json` in the package.
- **Custom (developer) MCP apps on ChatGPT may be web-only** [H1]. Published plugins must work on desktop and mobile, including UI components [O9].
- **URL-mode elicitation is the standard way to send a user to payment** [M2]. Servers must never use form mode for passwords, API keys or payment credentials, so protected requests always use URL mode.
- **Grok Bot** is built on Cursor: its MCP client identifies as clientInfo `Cursor` and speaks `2025-11-25`, with elicitation and no MCP Apps. Cursor's editor uses a different client name and declares MCP Apps (it gets links like everyone else, since only local dev draws the card); what each OAuth client declared at `initialize` tells them apart. Grok Bot now declares MCP Apps too but never reads the card, so a client that signs in through Cursor's hosted agents (a redirect URL under `https://www.cursor.com/agents/`, Grok Bot's `…/agents/mcp/oauth/callback` beside a localhost callback, and no `cursor://` one, which is the editor's) is Grok Bot whatever it declares.

## Claude's equivalents (short)

- **Display modes:** inline card, inline carousel and full screen, chosen through `appCapabilities.availableDisplayModes` and `ui/request-display-mode` [C2]. The docs list `pip` as a spec value but describe no pip behavior in Claude (?).
- **Elicitation forms:** Claude Code only (form and url) [C7]. On claude.ai, desktop and mobile, the model asks the store's questions in chat.
- **Events / notifications:** none for remote connectors. Claude Code "channels" push into a session, but only from a local stdio server started with `--channels`, during the research preview [C8]. A channel server that negotiates `2026-07-28` "can't deliver channel messages" [C7].
- **Stable sandbox origin:** `ui.domain = {sha256(connector URL)[0:32]}.claudemcpcontent.com`, which the card's metadata carries for Claude [C4] (unused while Claude gets no card).
- **Instance supersession:** Claude documents the newest-card-wins pattern with `BroadcastChannel`, which the card uses (claude.com/docs/connectors/building/mcp-apps/instance-supersession).

## Host detection

App-only tools (the secure step, plugin settings) are registered only for hosts we can identify as enforcing `ui.visibility`, and today only for the local dev host (`packages/agent/src/mcp/hosts.ts`). The access token's signed `client_id` names the OAuth client:

- **DCR client** (a Stytch ID): classified by the redirect URLs Stytch stores for it. `https://claude.ai/api/mcp/auth_callback` means Claude [C5]. `https://chatgpt.com/connector_platform_oauth_redirect` means ChatGPT [O6].
- **CIMD client** (an https URL): the URL's host and the document's redirect URLs must name the same host. ChatGPT: `https://chatgpt.com/oauth/client.json` with redirect `https://chatgpt.com/connector_platform_oauth_redirect`, or the per-connection `https://chatgpt.com/oauth/{callback_id}/client.json` with `https://chatgpt.com/connector/oauth/{callback_id}` [O6]. Claude's hosted apps use a claude.ai document with Claude's callback. Claude Code's `https://claude.ai/oauth/claude-code-client-metadata` lists only loopback redirects [C5], so it stays unknown and gets no app-only tools. The redirect URLs come from Stytch's record of the client (its `client_id_metadata_url` and `redirect_urls`) when it has one. Otherwise they come from the document itself: fetched only from ChatGPT's or Claude's domains, no redirects, capped at 64 KiB and 3 s, and it must name itself as `client_id`. Documents on other domains are never fetched.
- Whether Stytch puts the URL or a generated ID with `client_id_metadata_url` in the token's `client_id` is undocumented; both are handled. If a ChatGPT connection's secure page links lack `via=chatgpt` (`via=claude` for Claude), host detection failed.

Separately, every request knows whether its client draws Menta's card (`packages/agent/src/mcp/clients.ts`), so no result mentions a card to a client that can't show one. ChatGPT and Claude, though identified, are treated as card-less: they get no card resource, no `show_checkout_step` and no card tools. See EDD "Cards only where they are drawn".

## Per-host behavior

Each section covers the four moments of a checkout: start, store question, payment, finish.

### Web chat (the reference)

- **Start:** a one-line row in the conversation. A dock above the composer shows status, the newest step, the live view and Cancel.
- **Question:** the dock shows the store's form (choices, fields, Crossmint protected inputs). The user can also answer in chat. The agent's `watch_checkout` task wakes the model, so it asks without being prompted.
- **Payment:** the dock shows the saved-card list and Approve, with Crossmint verification or CVC when the rail asks, and "Add a card". A quiet "You approved …" line is posted.
- **Finish:** the outcome card lands in the conversation with the receipt total and the store order number. Cards live on `/wallet`, addresses on `/addresses` and connected assistants on `/connections`.

### ChatGPT Work Cloud and dots

- **Start:** the model calls `start`, which follows the checkout to the first thing that needs the user, and gives status in text. If the user asks ChatGPT to watch the checkout, it subscribes to `checkout.needs_you`, `checkout.order_placed` and `checkout.ended` with a `runId` filter [O3].
- **Question:** a `checkout.needs_you` event (or `start`/`continue` returning at that step) prompts one short message listing the store's options exactly; the model sends the reply with `answer`. No native forms (see the host note above).
- **Payment:** the model calls `spending_limits` and pays with a fitting one (`pay_with_spending_limit`), or calls `request_spending_limit` and gives the user the spending limit request page (`/spending-limit/<token>`, sealed with `via`) in one line. The user picks a card and how much it can spend there, with Crossmint's verification; approving pays the checkout, and the page offers "Back to ChatGPT". The model never sees `orderIntentId`.
- **Private details:** one line and the secure page (`/checkouts/[runId]?via=chatgpt`), where the user enters them in Crossmint's protected inputs.
- **Finish:** the final event or `continue` result reaches the chat, and ChatGPT reports the receipt total and order number as returned.
- **Settings:** Menta adds nothing to the plugin's settings page; `manage` gives the links to cards and addresses on Menta.
- **dots:** the same events; the event data includes the secure page URL.

### ChatGPT Chat (web, desktop, iOS, Android)

- **Start:** nothing pushes into Chat, so `start` and `continue` follow the run (up to 200 s per call) and return when the store asks or the run ends; the turn ends with one new message, which is what notifies the user.
- **Question:** the model asks in chat, listing the store's options exactly, and relays the reply with `answer`. No native forms [O2].
- **Payment and private details:** links, as in Work: the spending limit request page for a payment (after a fitting limit, if any, pays), the secure page for private details. On mobile the link opens in the browser, where card-network verification works.
- **Finish:** `continue` returns when the run ends, and the model reports the receipt total and order number as returned.

### Claude (web, desktop, iOS, Android)

- **Start:** `start` and `continue` follow the run (up to 200 s per call, under Claude's 240 s limit) and return when the user is needed or it ends.
- **Question:** the model asks in chat, listing the store's options exactly, and sends the reply with `answer`.
- **Payment:** a fitting spending limit pays (`pay_with_spending_limit`), or the model calls `request_spending_limit` and gives the user the spending limit request page in one line (`via=claude`: "Back to Claude"). The model then calls `continue`.
- **Private details:** one line and the secure page (`/checkouts/[runId]?via=claude`).
- **Finish:** the model reports the receipt as returned.

### Local dev

The `local` host (a loopback dev session, the MCP Apps reference host and the card fixtures) is the only identified host that still draws Menta's card (with the in-card secure step): `show_checkout_step` draws a step card when the user is needed, and the receipt; the card asks the store's questions, links to the spending limit request page, and opens the secure step in Crossmint's protected inputs.

### Claude Code, Codex and other text clients

- **Start:** a `{ checkout, next }` text result. `start` and `continue` follow the run for up to 50 s per call; on "still working" the model calls `continue` again.
- **Question:** a native form (MRTR elicitation) where the client declares it. Otherwise the model asks in chat (or with the host's own question picker) and calls `answer`.
- **Payment:** a URL-mode elicitation to `/checkouts/[runId]` where supported. Otherwise the model gives `pending.actionUrl` exactly as returned.
- **Finish:** the model reports the receipt as returned.

Clients that render MCP Apps (Cursor, VS Code) get no card either: text results, the secure page for private details and the spending limit request page for payments. Declaring MCP Apps still means no native forms (`formSupport` in `forms.ts`).

### Grok Bot

- **Start:** text results; no card is ever mentioned.
- **Question:** Grok Bot asks with its own question picker, listing the store's options exactly, then calls `answer`.
- **Payment and private details:** one line saying why plus the link: for payment the spending limit request page (sealed with `via` grok: "Allow Grok Bot to use your card on your terms." under the title), for private details the secure page (`via=grok`: "Menta needs some information to complete the task on <store>." under the title, and "Go back to Grok Bot and say you're done." once sent).
- **Updates:** Grok Bot has no MCP Events, but its routines can start from a webhook. The user says "Turn on Menta updates"; Grok Bot calls `grok_bot_updates_setup`, creates the routine and its webhook trigger, and the user pastes the routine's webhook URL and key at `/settings#grok-bot`. Menta then posts to it when a checkout Grok Bot followed needs the user or ends after Grok Bot stopped reading it. Updates are a backup: the model still calls `continue` while the turn lasts. See EDD "Grok Bot updates".
- **Install:** from the Cursor Marketplace (`plugins/menta`, with the repo-root `.cursor-plugin/marketplace.json`).

## Sources

- [O1] OpenAI, Plugin Extensions: https://developers.openai.com/plugins/build/extensions
- [O2] OpenAI MCP Extensions spec (platform table, entrypoints, settings, display modes, model context, `ui/message`, form elicitation): https://github.com/openai/mcp-extensions/blob/main/docs/spec.md
- [O3] OpenAI, MCP Events: https://developers.openai.com/plugins/build/mcp-events
- [O4] OpenAI, Add UI to your MCP server: https://developers.openai.com/plugins/build/chatgpt-ui
- [O5] OpenAI, Plugins reference (`window.openai`, `_meta` keys): https://developers.openai.com/plugins/reference
- [O6] OpenAI, Authentication: https://developers.openai.com/plugins/build/auth
- [O8] OpenAI, Add custom MCP server: https://developers.openai.com/api/docs/guides/custom-mcp-server
- [O9] OpenAI, Plugin guidelines: https://developers.openai.com/plugins/plugin-guidelines
- [O10] OpenAI, Package your plugin (`extensions["com.openai"].auth` in `mcp.json`): https://developers.openai.com/plugins/build/plugins#configure-mcp-authentication
- [L1] ChatGPT docs, Plugins: https://learn.chatgpt.com/docs/plugins
- [L2] ChatGPT docs, Use ChatGPT (Chat, Work, Cloud and local): https://learn.chatgpt.com/docs/use-chatgpt
- [L3] ChatGPT docs, Meet dots (access): https://learn.chatgpt.com/docs/dots
- [L5] ChatGPT docs, Pricing: https://learn.chatgpt.com/docs/pricing
- [L6] ChatGPT docs, Model Context Protocol (Codex hosts): https://learn.chatgpt.com/docs/extend/mcp
- [L7] ChatGPT docs, Codex App Server (`mcpServer/elicitation/request`): https://learn.chatgpt.com/docs/app-server
- [L8] ChatGPT docs, Codex config reference (`approval_policy.granular.mcp_elicitations`): https://learn.chatgpt.com/docs/config-file/config-reference
- [G1] openai/codex#53658, plugin `mcp.json` with `extensions` is rejected and the server dropped (open as of 2026-11-06): https://github.com/openai/codex/issues/53658
- [H1] OpenAI Help, Developer mode and MCP apps in ChatGPT: https://help.openai.com/en/articles/12584461. Search-result text only; treat as unverified.
- [M2] MCP spec 2026-07-28, Elicitation: https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation
- [M3] MCP, Extension support matrix (community-maintained): https://modelcontextprotocol.io/extensions/client-matrix
- [M4] MCP Apps spec 2026-01-26: https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx
- [C1] Claude, Build an MCP server for Claude: https://claude.com/docs/connectors/building
- [C2] Claude, MCP Apps design guidelines: https://claude.com/docs/connectors/building/mcp-apps/design-guidelines
- [C3] Claude, Open external links from MCP Apps: https://claude.com/docs/connectors/building/mcp-apps/external-links
- [C4] Claude, Troubleshoot MCP Apps: https://claude.com/docs/connectors/building/mcp-apps/troubleshooting
- [C5] Claude, Authentication for connectors: https://claude.com/docs/connectors/building/authentication
- [C6] Claude, Add a connector that isn't in the directory: https://claude.com/docs/connectors/custom/add-unlisted
- [C7] Claude Code, MCP: https://code.claude.com/docs/en/mcp
- [C8] Claude Code, Channels reference: https://code.claude.com/docs/en/channels-reference
- [X1] Cursor, MCP: https://cursor.com/docs/mcp
- [X2] xAI, Grok connectors: https://docs.x.ai/grok/connectors
- [X3] Gemini CLI, MCP servers: https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md
