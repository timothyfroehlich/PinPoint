import { getSupabaseEnv } from "~/lib/supabase/env";

/**
 * Path segment the MCP route handler is mounted under. The route lives at
 * `src/app/api/mcp/[transport]/route.ts`, so `basePath` is `/api/mcp` and the
 * streamable-HTTP endpoint mcp-handler derives is `/api/mcp/mcp`.
 */
export const MCP_BASE_PATH = "/api/mcp";

/**
 * Well-known path where the OAuth Protected Resource Metadata (RFC 9728) is
 * served. Advertised to MCP clients in the 401 `WWW-Authenticate` header so
 * they can discover the authorization server.
 */
export const MCP_RESOURCE_METADATA_PATH =
  "/.well-known/oauth-protected-resource";

/**
 * The OAuth 2.1 authorization server(s) backing this resource server. PinPoint
 * uses Supabase Auth's OAuth server, whose issuer is the GoTrue mount under the
 * project URL. Derived from `NEXT_PUBLIC_SUPABASE_URL` — no new env var
 * (CORE-SEC-009).
 */
export function getAuthServerUrls(): string[] {
  const { url } = getSupabaseEnv();
  return [`${url.replace(/\/+$/, "")}/auth/v1`];
}
