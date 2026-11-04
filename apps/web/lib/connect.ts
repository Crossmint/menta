/**
 * The setup prompt for the Connect page, built from the MCP server URL
 * (`{OCA_WEB_ORIGIN}/mcp`). CLI syntax checked against the Codex and Claude
 * Code docs on 2026-10-06.
 */

/** Server name in configs and CLI commands. */
const serverName = "menta";

/** Codex: adds the streamable HTTP server and starts OAuth sign-in when it detects support. */
export function codexCommand(url: string) {
  return `codex mcp add ${serverName} --url ${url}`;
}

/** Claude Code: user scope, so it works in every project; sign in with `/mcp`. */
export function claudeCodeCommand(url: string) {
  return `claude mcp add --transport http --scope user ${serverName} ${url}`;
}

/** What the user pastes into any assistant: it adds the server itself, opens its settings, or walks them through it. */
export function setupPrompt(url: string) {
  return `Add the Menta MCP server so you can buy things for me.

URL: ${url}
Type: remote HTTP (streamable). Sign-in: OAuth in the browser, no API key.

1. If you can add MCP servers with your own tools, add it and confirm it's connected.
   Codex: ${codexCommand(url)}
   Claude Code: ${claudeCodeCommand(url)} (then I sign in with /mcp)
2. If you can't, but you can use a browser or my computer, add it in your app as a custom connector or MCP server named Menta with the URL above (in ChatGPT: chatgpt.com/plugins, then Add, then Add custom MCP server, with OAuth, and Create as a plugin). Stop at the sign-in screen so I can approve it.
3. Otherwise, walk me through adding it in your settings, one step at a time.

If you're Grok Bot: once it's connected, also turn on Menta updates, so you can tell me when a checkout needs me even after this chat. Call grok_bot_updates_setup, create the routine it describes with a webhook trigger, then ask me to paste the routine's Webhook URL and Webhook key at ${accountUrl(url)}.`;
}

/** The Grok Bot row in Settings, on the same origin as the MCP URL. */
function accountUrl(url: string) {
  try {
    return new URL("/settings#grok-bot", url).href;
  } catch {
    return "/settings#grok-bot";
  }
}
