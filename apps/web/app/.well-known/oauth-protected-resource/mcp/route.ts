import { getMcpEndpoint } from "@oca/agent/mcp";

export const dynamic = "force-dynamic";

/** RFC 9728 metadata for /mcp: points MCP clients at Stytch to sign in. */
function metadata(request: Request) {
  return getMcpEndpoint().metadata(request);
}

export { metadata as GET, metadata as HEAD, metadata as OPTIONS };
