import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";

import { getAuthServerUrls } from "~/lib/mcp/config";

export const runtime = "nodejs";

/**
 * OAuth Protected Resource Metadata (RFC 9728). Tells MCP clients which
 * authorization server (Supabase Auth) to run the OAuth flow against. The auth
 * server list is derived per-request so a missing env var surfaces as a request
 * error rather than a module-load crash.
 */
export function GET(request: Request): Response {
  return protectedResourceHandler({ authServerUrls: getAuthServerUrls() })(
    request
  );
}

/** Browser-based MCP clients preflight the metadata endpoint. */
export const OPTIONS = metadataCorsOptionsRequestHandler();
