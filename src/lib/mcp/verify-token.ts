import "server-only";

import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { log } from "~/lib/logger";
import { getUserAccessLevel } from "~/lib/permissions/access";
import { ACCESS_LEVELS, type AccessLevel } from "~/lib/permissions/matrix";
import { getSupabaseEnv } from "~/lib/supabase/env";

/**
 * The minimum access level an OAuth caller must hold to reach ANY MCP tool.
 *
 * This is the v1 security posture (spec §"verifyToken"): a leaked non-admin
 * token gets nothing at the door. Per-tool `checkPermission()` still runs
 * underneath each tool as defense in depth — the admin gate is not a substitute
 * for it.
 */
const REQUIRED_ACCESS_LEVEL: AccessLevel = "admin";

/**
 * Resolved identity attached to every authorized MCP request, carried in
 * `AuthInfo.extra` and read back by tool handlers via
 * {@link requireMcpAuthContext}.
 *
 * Built inline (via `satisfies`) when populating `AuthInfo.extra` so the value
 * keeps its literal type and stays assignable to `Record<string, unknown>`.
 */
export interface McpAuthContext {
  userId: string;
  accessLevel: AccessLevel;
  /** OAuth `client_id` claim, for the audit trail. Empty string when absent. */
  clientId: string;
}

/**
 * The subset of verified JWT claims the MCP layer consumes. Kept minimal and
 * injectable so unit tests mock the Supabase verification at its boundary
 * (CORE-TEST-006) without synthesizing a full GoTrue response.
 */
export interface VerifiedClaims {
  /** The authenticated user's UUID (`sub`). */
  userId: string;
  /** The OAuth `client_id` claim, or `""` when the token carries none. */
  clientId: string;
}

export interface VerifyTokenDeps {
  /**
   * Validate a bearer JWT at the Supabase boundary. Returns the claims we need,
   * or `null` for any expired / malformed / bad-signature token.
   */
  verifyClaims: (token: string) => Promise<VerifiedClaims | null>;
  getUserAccessLevel: (userId: string) => Promise<AccessLevel>;
}

/**
 * A lazily-created, session-less Supabase client used only for JWT verification.
 * `getClaims()` caches the project JWKS on the client instance, so we reuse one
 * client across requests rather than paying a JWKS fetch per call.
 */
let claimsClient: SupabaseClient | undefined;

function getClaimsClient(): SupabaseClient {
  if (!claimsClient) {
    const { url, publishableKey } = getSupabaseEnv();
    claimsClient = createClient(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return claimsClient;
}

/**
 * Default boundary implementation: verify the JWT against the project JWKS via
 * `supabase.auth.getClaims()` (local signature + `exp` validation, no per-call
 * network hop once the JWKS is cached).
 */
async function verifyClaimsWithSupabase(
  token: string
): Promise<VerifiedClaims | null> {
  const { data, error } = await getClaimsClient().auth.getClaims(token);
  if (error || !data) {
    return null;
  }
  const { sub, client_id: clientIdClaim } = data.claims;
  if (typeof sub !== "string" || sub.length === 0) {
    return null;
  }
  // Require the OAuth `client_id` claim. Tokens minted by Supabase's OAuth
  // server (the intended path — the caller went through DCR/consent) carry it;
  // plain web-session access tokens (cookie auth) do NOT. Rejecting tokens
  // without it enforces the OAuth-consent boundary at the token layer, so a
  // leaked/stolen admin *session* token cannot drive this write-capable MCP
  // surface. (PR #1707 review finding.)
  if (typeof clientIdClaim !== "string" || clientIdClaim.length === 0) {
    return null;
  }
  return { userId: sub, clientId: clientIdClaim };
}

const defaultDeps: VerifyTokenDeps = {
  verifyClaims: verifyClaimsWithSupabase,
  getUserAccessLevel,
};

/**
 * Build the `verifyToken` callback for `withMcpAuth`.
 *
 * Flow: extract bearer → verify JWT at the Supabase boundary → resolve the
 * user's access level → require {@link REQUIRED_ACCESS_LEVEL} → hand back an
 * {@link AuthInfo} whose `extra` carries the {@link McpAuthContext}. Any failure
 * (missing/invalid token, unknown user, non-admin) returns `undefined`, which
 * `withMcpAuth` turns into a 401.
 */
export function createVerifyToken(deps: VerifyTokenDeps = defaultDeps) {
  return async function verifyToken(
    _request: Request,
    bearerToken?: string
  ): Promise<AuthInfo | undefined> {
    if (!bearerToken) {
      return undefined;
    }

    const claims = await deps.verifyClaims(bearerToken);
    if (!claims) {
      return undefined;
    }

    const accessLevel = await deps.getUserAccessLevel(claims.userId);
    if (accessLevel !== REQUIRED_ACCESS_LEVEL) {
      // A valid token for a real, non-admin user. Log the rejection — this is a
      // write-capable production surface and a denied admin gate is audit-worthy.
      log.warn(
        {
          scope: "mcp.auth",
          outcome: "rejected",
          reason: "not_admin",
          userId: claims.userId,
          clientId: claims.clientId,
          accessLevel,
        },
        "mcp.auth rejected"
      );
      return undefined;
    }

    return {
      token: bearerToken,
      clientId: claims.clientId,
      scopes: [],
      extra: {
        userId: claims.userId,
        accessLevel,
        clientId: claims.clientId,
      } satisfies McpAuthContext,
    };
  };
}

/** The production `verifyToken` used by the route handler. */
export const verifyToken = createVerifyToken();

function isAccessLevel(value: unknown): value is AccessLevel {
  return (
    typeof value === "string" &&
    (ACCESS_LEVELS as readonly string[]).includes(value)
  );
}

/**
 * Read the {@link McpAuthContext} back out of a tool handler's `authInfo`.
 * Throws if it is missing or malformed — that would mean the tool was reached
 * without `withMcpAuth` in front of it, which is a wiring bug, not a user error.
 */
export function requireMcpAuthContext(
  authInfo: AuthInfo | undefined
): McpAuthContext {
  const extra = authInfo?.extra;
  if (
    !extra ||
    typeof extra["userId"] !== "string" ||
    typeof extra["clientId"] !== "string" ||
    !isAccessLevel(extra["accessLevel"])
  ) {
    throw new Error(
      "MCP tool invoked without a resolved auth context — check withMcpAuth wiring"
    );
  }
  return {
    userId: extra["userId"],
    accessLevel: extra["accessLevel"],
    clientId: extra["clientId"],
  };
}
