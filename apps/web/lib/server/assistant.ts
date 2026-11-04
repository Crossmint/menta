import { isCursorAgentRedirects } from "@oca/agent/mcp";
import type { Client } from "stytch";

/** An assistant asking to connect, as sign-in and consent show it. */
export interface Assistant {
  readonly name: string;
  /** The logo it registered with Stytch, https only. */
  readonly logoUrl: string | null;
  /** Its official app icon in public/assistants, when we have one. */
  readonly icon: string | null;
}

/** The official app icon (public/assistants) for an assistant we know by name. */
export function officialIcon(name: string) {
  if (/grok|xai/i.test(name)) {
    return "/assistants/grokbot.png";
  }
  if (/chatgpt|openai|codex/i.test(name)) {
    return "/assistants/chatgpt.png";
  }
  if (/claude|anthropic/i.test(name)) {
    return "/assistants/claude.png";
  }
  return null;
}

/** Assistants whose client ID is a metadata document URL, by its exact host. */
const METADATA_HOSTS: Readonly<Record<string, string>> = {
  "chatgpt.com": "ChatGPT",
  "claude.ai": "Claude",
  "claude.com": "Claude",
};

/**
 * Who an OAuth client is, from what it registered with Stytch. Grok Bot
 * registers as "Cursor" through Cursor's hosted agents, so its redirect URLs
 * name it, as on the MCP server (`isCursorAgentRedirects`, docs/HOSTS.md). A
 * metadata-URL client ID Stytch can't look up names only ChatGPT or Claude,
 * by exact host. Null when we can't tell.
 */
export async function describeClient(
  client: Pick<Client, "connectedApp">,
  clientId: string,
): Promise<Assistant | null> {
  try {
    const { connected_app } = await client.connectedApp.clients.get({
      client_id: clientId,
    });
    const name = isCursorAgentRedirects(connected_app.redirect_urls)
      ? "Grok Bot"
      : connected_app.client_name.trim();
    if (!name) {
      return null;
    }
    return {
      name,
      logoUrl: connected_app.logo_url?.startsWith("https://")
        ? connected_app.logo_url
        : null,
      icon: officialIcon(name),
    };
  } catch {
    const name =
      URL.canParse(clientId) && clientId.startsWith("https://")
        ? METADATA_HOSTS[new URL(clientId).host]
        : undefined;
    return name ? { name, logoUrl: null, icon: officialIcon(name) } : null;
  }
}
