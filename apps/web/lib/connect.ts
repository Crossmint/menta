/**
 * The setup prompt for the Connect page, built from the MCP server URL
 * (`{OCA_WEB_ORIGIN}/mcp`). One line for every assistant: they know how to add
 * an MCP server, and the server's own instructions and tools say the rest
 * (Grok Bot's updates included).
 */
export function setupPrompt(url: string) {
  return `Install this MCP server so you can buy things for me: ${url}`;
}
