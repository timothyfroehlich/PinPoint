/**
 * The only HTTP path that serves PinPoint's MCP transport.
 *
 * mcp-handler 2.x no longer performs pathname routing itself, so the route
 * keeps this explicit check as defense in depth in addition to Next.js's
 * static `api/mcp/mcp` segment. Legacy `/sse` and `/message` paths, plus any
 * arbitrary transport segment, must continue to return 404.
 */
export const MCP_ENDPOINT_PATH = "/api/mcp/mcp";
