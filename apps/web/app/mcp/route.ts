import { getMcpEndpoint } from "@oca/agent/mcp";
import { after } from "next/server";

export const dynamic = "force-dynamic";
/**
 * start, answer and continue follow a checkout for up to 200 s in Claude and
 * ChatGPT (50 s elsewhere) before returning "still working"; 240 s leaves
 * headroom without letting a stuck call run for the default 300.
 */
export const maxDuration = 240;
/** Background work of a request stops this long after it started (under maxDuration). */
const FOLLOW_MS = 50_000;

/** Menta's MCP server for ChatGPT, Claude and other assistants (Streamable HTTP). */
async function serve(request: Request) {
  const started = Date.now();
  if (request.method === "POST") {
    // Which protocol and methods each host uses (no params, no tokens).
    const body = await request
      .clone()
      .json()
      .catch(() => null);
    const methods = (Array.isArray(body) ? body : [body])
      .map((message) => {
        if (!message || typeof message.method !== "string") {
          return null;
        }
        const tool = message.params?.name;
        return typeof tool === "string"
          ? `${message.method} ${tool}`
          : message.method;
      })
      .filter(Boolean);
    // Whether tool calls ask for progress notifications (a flag, no token).
    const progress = (Array.isArray(body) ? body : [body]).some(
      (message) =>
        message?.method === "tools/call" &&
        message.params?._meta?.progressToken !== undefined,
    );
    console.info("MCP request", {
      methods,
      protocol: request.headers.get("mcp-protocol-version"),
      client: request.headers.get("user-agent")?.slice(0, 80) ?? null,
      ...(methods.some((method) => method?.startsWith("tools/call"))
        ? { progressToken: progress }
        : {}),
    });
    // Which client this is and what it can draw (names and capability keys only).
    for (const message of Array.isArray(body) ? body : [body]) {
      // 2026-07-28 tool calls carry the client's capabilities themselves.
      const declared =
        message?.method === "tools/call"
          ? message.params?._meta?.[
              "io.modelcontextprotocol/clientCapabilities"
            ]
          : null;
      if (declared && typeof declared === "object") {
        console.info("MCP capabilities", {
          tool: String(message.params?.name ?? "").slice(0, 60),
          extensions: Object.keys(declared.extensions ?? {}),
          openaiForms: Boolean(
            declared.extensions?.["openai/elicitation"]?.form,
          ),
          openaiElicitation: Object.keys(
            declared.extensions?.["openai/elicitation"] ?? {},
          ),
          elicitation: declared.elicitation
            ? Object.keys(declared.elicitation)
            : null,
          retry: message.params?.requestState !== undefined,
        });
      }
      if (message?.method === "initialize") {
        const capabilities = message.params?.capabilities ?? {};
        console.info("MCP client", {
          name: String(message.params?.clientInfo?.name ?? "").slice(0, 60),
          version: String(message.params?.clientInfo?.version ?? "").slice(
            0,
            30,
          ),
          capabilities: Object.keys(capabilities),
          extensions: Object.keys(capabilities.extensions ?? {}),
          // Elicitation modes (form, url); `{}` means form only.
          elicitation: capabilities.elicitation
            ? Object.keys(capabilities.elicitation)
            : null,
        });
      }
    }
  }
  // MCP Events checks and deliveries finish after the response, and a Grok
  // Bot updates follower may keep reading until shortly before maxDuration.
  return getMcpEndpoint().fetch(request, {
    waitUntil: (task) => after(() => task),
    followUntil: started + FOLLOW_MS,
  });
}

export { serve as DELETE, serve as GET, serve as POST };
