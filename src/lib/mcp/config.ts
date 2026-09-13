import { getSiteUrl } from "~/lib/url";

/**
 * The only HTTP path that serves PinPoint's MCP transport.
 *
 * mcp-handler 2.x no longer performs pathname routing itself, so the route
 * keeps this explicit check as defense in depth in addition to Next.js's
 * static `api/mcp/mcp` segment. Legacy `/sse` and `/message` paths, plus any
 * arbitrary transport segment, must continue to return 404.
 */
export const MCP_ENDPOINT_PATH = "/api/mcp/mcp";

/** RFC 9728 discovery document advertised by authenticated MCP challenges. */
export const MCP_RESOURCE_METADATA_PATH =
  "/.well-known/oauth-protected-resource";

/** Canonical protected-resource identifier used as the OAuth access-token aud. */
export function getMcpResourceUrl(): string {
  return new URL(
    MCP_ENDPOINT_PATH,
    `${getSiteUrl().replace(/\/$/, "")}/`
  ).toString();
}

/** Supabase Auth issuer and OAuth authorization-server identifier. */
export function getMcpAuthorizationServerUrl(): string {
  const baseUrl =
    process.env["SUPABASE_URL"] ?? process.env["NEXT_PUBLIC_SUPABASE_URL"];
  if (!baseUrl) {
    throw new Error(
      "Missing Supabase URL for MCP OAuth discovery and token verification."
    );
  }
  return `${baseUrl.replace(/\/$/, "")}/auth/v1`;
}
