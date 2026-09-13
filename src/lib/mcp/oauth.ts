import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  getMcpAuthorizationServerUrl,
  getMcpResourceUrl,
} from "~/lib/mcp/config";
import { createAdminClient } from "~/lib/supabase/admin";

const oauthClaimsSchema = z.object({
  iss: z.string().url(),
  aud: z.union([z.string(), z.array(z.string())]),
  exp: z.number().int(),
  sub: z.string().uuid(),
  client_id: z.string().min(1),
  scope: z.string().optional(),
});

export interface VerifiedOAuthToken {
  algorithm: string;
  claims: z.infer<typeof oauthClaimsSchema>;
}

export interface McpOAuthClient {
  clientId: string;
  audience: string;
  enabled: boolean;
}

export interface McpOAuthConfig {
  issuer: string;
  resource: string;
  adminUserId: string;
  dcrCanary: boolean;
}

/**
 * Verify a Supabase access-token signature with the project's JWKS, then
 * narrow only the claims the MCP authorization boundary consumes.
 */
export async function verifySupabaseOAuthToken(
  token: string
): Promise<VerifiedOAuthToken | undefined> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data) {
    return undefined;
  }

  const parsed = oauthClaimsSchema.safeParse(data.claims);
  if (!parsed.success) {
    return undefined;
  }

  return { algorithm: data.header.alg, claims: parsed.data };
}

/** Load one application-approved OAuth client without trusting token claims. */
export async function findMcpOAuthClient(
  clientId: string
): Promise<McpOAuthClient | undefined> {
  // Keep database initialization lazy so importing the verifier does not make
  // the optional MCP surface mandatory at build time.
  const [{ db }, { mcpOauthClients }] = await Promise.all([
    import("~/server/db"),
    import("~/server/db/schema"),
  ]);
  const client = await db.query.mcpOauthClients.findFirst({
    where: eq(mcpOauthClients.clientId, clientId),
    columns: { clientId: true, audience: true, enabled: true },
  });
  return client;
}

/** Resolve OAuth's fail-closed runtime configuration. */
export function getMcpOAuthConfig(): McpOAuthConfig | undefined {
  const adminUserId = process.env["MCP_ADMIN_USER_ID"];
  if (!adminUserId) {
    return undefined;
  }

  return {
    issuer: getMcpAuthorizationServerUrl(),
    resource: getMcpResourceUrl(),
    adminUserId,
    dcrCanary: process.env["MCP_OAUTH_DCR_CANARY"] === "true",
  };
}
