# Menta plugin

Menta as an installable plugin for ChatGPT, Codex, Claude, Cursor and Grok Bot. It bundles the Menta MCP server (`https://menta.crossmint.com/mcp`) with two skills: `setup`, the onboarding ChatGPT runs after install, and `buy`, the server's own instructions. Users still sign in to Menta, and Menta pays only from spending limits they approve themselves in Crossmint's form; the assistant never can approve one.

## What's here

| File | For | Source |
| --- | --- | --- |
| `plugin.json`, `mcp.json` | ChatGPT and Codex (portable Agent Plugins format; OpenAI presentation, `onboardingSkill`, directory review cases and release notes under `extensions["com.openai"]`) | generated |
| `.claude-plugin/plugin.json`, `.mcp.json` | Claude Code, claude.ai, Cowork | generated |
| `.cursor-plugin/plugin.json` | Cursor and Grok Bot (Cursor Marketplace): name, logo, `skills/` and the MCP server inline by URL | generated |
| `../../.cursor-plugin/marketplace.json` | The repo-root Cursor marketplace that points at this folder | by hand (checked by the test) |
| `skills/setup/SKILL.md` | Onboarding: address, card, how payments are approved | by hand |
| `skills/buy/SKILL.md` | The MCP server's instructions, verbatim | generated |
| `assets/` | Icons from `apps/web/lib/brand.ts` | generated |

"Generated" files come from `apps/web/lib/plugin.ts`. After changing the server instructions, the logo or the origin, run `pnpm plugin:sync`; `pnpm test` fails until you do. Marketplaces for local installs: `.agents/plugins/marketplace.json` at the repo root (ChatGPT, Codex) and `plugins/.claude-plugin/marketplace.json` (Claude).

## Forks

This plugin is the official one and points at `https://menta.crossmint.com/mcp`. To ship a plugin for your own deployment, set `PRODUCTION_ORIGIN` in `apps/web/lib/site.ts` to your origin and `PRODUCTION_AUTHORIZATION_SERVER` to your `OCA_MCP_AUTHORIZATION_SERVER_URL`, then run `pnpm plugin:sync`, which rewrites the generated files to point at your server. Give it your own name and branding before publishing it anywhere: forks may not present themselves as Crossmint or Menta by Crossmint (see `NOTICE`).

## Install locally to test

### ChatGPT (desktop app)

1. Go to [chatgpt.com/plugins](https://chatgpt.com/plugins), select **Add**, then **Add custom MCP server**. Name it Menta, keep **Server URL** and paste `https://menta.crossmint.com/mcp`, authentication OAuth. Tick **I understand and want to continue**, then **Create as a plugin**. Copy the ID from the browser URL; it starts with `plugin_asdk_app`.
2. Copy `plugins/menta` to `~/.codex/plugins/menta` and map that server into the copy (never into the repo: packages submitted to the directory can't contain app references). The easiest way is `@plugin-creator` in Work mode: "Wire ~/.codex/plugins/menta to my MCP server plugin_asdk_app_… and keep its skills." By hand, add `.app.json` in the shape OpenAI's own plugins use (Notion's has `asdk_app_…`, the URL ID without `plugin_`; unverified which form local installs want) and `"apps": "./.app.json"` under `extensions["com.openai"]` in the copy's `plugin.json`:

   ```json
   { "apps": { "menta": { "id": "asdk_app_…" } } }
   ```

3. Make the marketplace visible: add the `.agents/plugins/marketplace.json` entry to `~/.agents/plugins/marketplace.json` with `"path": "./.codex/plugins/menta"`.
4. Restart the ChatGPT desktop app. Open the Plugins Directory, choose **Menta (local)**, and install. Sign in to Menta when asked.
5. Check:
   - **Setup** runs the `setup` skill: it offers the account link for a card and to save your delivery address in chat, and says it pays only from spending limits you approve.
   - "Set up Menta" gives the links for cards and addresses (the `manage` tool). The plugin shows no Settings of its own: ChatGPT gets no Menta settings view or checkout card.
   - "Buy a 4-pack of AA batteries on Amazon, under $15" starts a checkout; the assistant asks the store's questions in chat and, at payment, links to the spending limit page.

After changing the package, re-sync, update the copy your marketplace points to and restart the app.

### Codex

Codex reads the same marketplace. `codex plugin marketplace add /path/to/your/clone` registers it; install from the ChatGPT desktop app's Plugins Directory (Codex), or enable it for this repo in `.codex/config.toml`:

```toml
[plugins."menta@oca-local"]
enabled = true
```

Codex connects to the server in `.mcp.json` (checked with Codex CLI 0.142, which loads no server from `mcp.json`), so the OpenAI `extensions` block in `mcp.json` doesn't affect it ([openai/codex#53658](https://github.com/openai/codex/issues/53658) is about that block); keep `.mcp.json` in the package. To test against a local server, point `url` at `http://localhost:3000/mcp` in your installed copy's `.mcp.json` (not in the repo).

### Claude Code

```sh
claude --plugin-dir ./plugins/menta
```

or install it from the local marketplace:

```sh
claude plugin marketplace add ./plugins
claude plugin install menta@oca-local
```

Run `/mcp` to sign in to Menta. The skills appear as `/menta:setup` and `/menta:buy`. `claude plugin validate ./plugins/menta` checks the manifest.

### claude.ai and Cowork

Zip the `plugins/menta` folder, then **Customize > Plugins > Add > Upload plugin**. Connect Menta from the plugin's **Connectors** tab. Claude has no onboarding hook or plugin settings, so run the setup skill by asking "set up Menta".

### Cursor

Cursor reads `.cursor-plugin/plugin.json` (it also loads the portable root `plugin.json`). To test before publishing, copy the folder into Cursor's local plugins and restart Cursor:

```sh
mkdir -p ~/.cursor/plugins/local
cp -R plugins/menta ~/.cursor/plugins/local/menta
```

Symlinks only load when they point inside that folder, so copy rather than link. Menta shows up under MCP with OAuth; sign in, then try "Buy a 4-pack of AA batteries on Amazon, under $15". The `buy` and `setup` skills come from `skills/`.

### Grok Bot (Cursor Marketplace)

Grok Bot installs plugins from the Cursor Marketplace, and its skills are shared across all of a user's Bots. Grok Bot calls our MCP server from Cursor's hosted backend (it identifies as `Cursor`), so OAuth and the tools work as they do for a connector added by hand.

Submitting to the Cursor Marketplace:

1. Check the Marketplace checklist (cursor.com/docs/reference/plugins): a valid manifest with a unique kebab-case `name` (`menta`), a clear `description`, valid skill files, a committed logo by relative path (`assets/logo.png`), this README, and a local test (above). The repository must be public and open source (Apache-2.0).
2. The plugin lives in a subfolder, so the repo root has `.cursor-plugin/marketplace.json` pointing at `plugins/menta`. `pnpm test` checks it matches `apps/web/lib/plugin.ts`.
3. Submit the repository URL at cursor.com/marketplace/publish. Cursor reviews every plugin by hand.
4. After it's listed: in Grok Bot, open the Marketplace, add Menta and sign in. Then set up Grok Bot updates at `/settings#grok-bot` (a routine with a webhook trigger), so the Bot hears when a checkout needs you after it stops.

## Submit to the directories

The repository can stay private for ChatGPT and for the Claude connector. Claude's plugin listing and the Cursor Marketplace (Grok Bot) need it public.

### ChatGPT

1. In platform.openai.com organization settings, verify Crossmint (business verification), so the listing names Crossmint.
2. At [platform.openai.com/plugins](https://platform.openai.com/plugins), **Upload new or existing plugin**, as Crossmint, with a ZIP of this folder:

   ```sh
   cd plugins/menta && zip -r ../../menta-chatgpt.zip . -x '.claude-plugin/*' '.cursor-plugin/*' '.mcp.json' && cd -
   ```

3. Verify the domain: set `OPENAI_APPS_CHALLENGE` on Vercel to the token the dashboard shows and redeploy; it's served at `https://menta.crossmint.com/.well-known/openai-apps-challenge`.
4. Fill in what the package doesn't carry: the demo video URL, and a reviewer account in **Review details** (no MFA: a Stytch email code won't work for reviewers, so use an `OCA_REVIEW_ACCOUNTS` email and its password, and tell reviewers to sign in first at `https://menta.crossmint.com/login?password`, which nothing links to; see `docs/CREDENTIALS.md`). The review cases, commerce declaration, listing URLs and release notes come from `plugin.json`; the MCP server's OAuth (CIMD, with Stytch's authorization and token endpoints, which the upload asks for) from `mcp.json`.
5. **Submit for review**. After approval, **Publish plugin**. MCP server changes reach the listing without a new ZIP; skills, listing and `mcp.json` changes (such as the OAuth endpoints) need one.

### Claude

Both in the developer portal at [claude.ai/directory/manage](https://claude.ai/directory/manage) → **Submit new**:

1. **MCP connector**: `https://menta.crossmint.com/mcp`. Have ready the docs URL, privacy policy URL, support contact, icon, a reviewer account, and 3–5 PNG carousel screenshots (at least 1000px wide, each with its prompt; see `docs/DIRECTORIES.md`). Under allowed link URIs, add `https://menta.crossmint.com`, Menta's own pages that Claude links to (the spending limit page and the secure page).
2. **Plugin bundle**: repository `Crossmint/open-commerce-assistant`, plugin path `plugins/menta`. A private repository needs the Claude GitHub App installed on it and consent to upload its source for scanning; it goes live only once public. Run `claude plugin validate ./plugins/menta` first.
