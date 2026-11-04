import { getMcpEndpoint } from "@oca/agent/mcp";

export const dynamic = "force-dynamic";

/**
 * Root fallback for the /mcp metadata: MCP clients that miss the 401's
 * `resource_metadata` try the path-inserted URL, then this one.
 */
function metadata(request: Request) {
  return getMcpEndpoint().metadata(request);
}

export { metadata as GET, metadata as HEAD, metadata as OPTIONS };
