import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import type { AuthInfo } from "@modelcontextprotocol/server";
import { z } from "zod";

import { log } from "~/lib/logger";
import {
  findMcpOAuthClient,
  getMcpOAuthConfig,
  verifySupabaseOAuthToken,
  type McpOAuthClient,
  type McpOAuthConfig,
  type VerifiedOAuthToken,
} from "~/lib/mcp/oauth";
import { getUserAccessLevel } from "~/lib/permissions/access";
import { checkPermission } from "~/lib/permissions/helpers";
import { ACCESS_LEVELS, type AccessLevel } from "~/lib/permissions/matrix";

const REQUIRED_PERMISSION = "admin.access";
const MIN_BEARER_TOKEN_LENGTH = 32;
const BEARER_CLIENT_ID = "claude-code-bearer";
const REQUIRED_OAUTH_ALGORITHM = "ES256";
const SUPABASE_DEFAULT_AUDIENCE = "authenticated";

const adminUserIdSchema = z.string().uuid();

export interface McpAuthContext {
  userId: string;
  accessLevel: AccessLevel;
  clientId: string;
  authMode: "bearer" | "oauth";
}

export interface McpBearerConfig {
  bearerToken: string;
  adminUserId: string;
}

export interface VerifyTokenDeps {
  getConfig: () => McpBearerConfig | undefined;
  getOAuthConfig: () => McpOAuthConfig | undefined;
  verifyOAuthToken: (token: string) => Promise<VerifiedOAuthToken | undefined>;
  findOAuthClient: (clientId: string) => Promise<McpOAuthClient | undefined>;
  getUserAccessLevel: (userId: string) => Promise<AccessLevel>;
}

function reject(reason: string, detail: Record<string, unknown> = {}): void {
  log.warn(
    { scope: "mcp.auth", outcome: "rejected", reason, ...detail },
    "mcp.auth rejected"
  );
}

/** OAuth remains usable when the legacy Claude bearer token is absent. */
function readConfigFromEnv(): McpBearerConfig | undefined {
  const bearerToken = process.env["MCP_BEARER_TOKEN"];
  const adminUserId = process.env["MCP_ADMIN_USER_ID"];

  if (!bearerToken) return undefined;
  if (!adminUserId) {
    reject("bearer_admin_user_id_missing");
    return undefined;
  }
  if (bearerToken.length < MIN_BEARER_TOKEN_LENGTH) {
    reject("bearer_token_too_short", { minLength: MIN_BEARER_TOKEN_LENGTH });
    return undefined;
  }
  if (!adminUserIdSchema.safeParse(adminUserId).success) {
    reject("admin_user_id_not_uuid");
    return undefined;
  }

  return { bearerToken, adminUserId };
}

const defaultDeps: VerifyTokenDeps = {
  getConfig: readConfigFromEnv,
  getOAuthConfig: getMcpOAuthConfig,
  verifyOAuthToken: verifySupabaseOAuthToken,
  findOAuthClient: findMcpOAuthClient,
  getUserAccessLevel,
};

function secretsMatch(presented: string, expected: string): boolean {
  const digest = (value: string): Buffer =>
    createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(presented), digest(expected));
}

function audienceIncludes(
  audience: string | string[],
  expected: string
): boolean {
  return Array.isArray(audience)
    ? audience.includes(expected)
    : audience === expected;
}

async function requireLiveAdmin(
  deps: VerifyTokenDeps,
  userId: string,
  clientId: string
): Promise<AccessLevel | undefined> {
  const accessLevel = await deps.getUserAccessLevel(userId);
  if (!checkPermission(REQUIRED_PERMISSION, accessLevel)) {
    reject("permission_denied", {
      userId,
      clientId,
      accessLevel,
      permission: REQUIRED_PERMISSION,
    });
    return undefined;
  }
  return accessLevel;
}

function authInfo(
  token: string,
  context: McpAuthContext,
  scopes: string[] = [],
  expiresAt?: number
): AuthInfo {
  const base = {
    token,
    clientId: context.clientId,
    scopes,
    extra: { ...context } satisfies McpAuthContext,
  };
  return expiresAt === undefined ? base : { ...base, expiresAt };
}

/**
 * Build the dual-mode verifier used by `withMcpAuth`.
 *
 * The static bearer path remains solely for the existing Claude connection.
 * OAuth requires a Supabase-verified ES256 signature, exact issuer/resource,
 * Tim's subject UUID, an enabled client registration, and a live admin role.
 * The explicit DCR canary temporarily accepts Supabase's default audience and
 * an unregistered client for Tim so Codex's generated client id can be pinned.
 */
export function createVerifyToken(deps: VerifyTokenDeps = defaultDeps) {
  return async function verifyToken(
    _request: Request,
    bearerToken?: string
  ): Promise<AuthInfo | undefined> {
    if (!bearerToken) return undefined;

    const bearerConfig = deps.getConfig();
    if (bearerConfig && secretsMatch(bearerToken, bearerConfig.bearerToken)) {
      const accessLevel = await requireLiveAdmin(
        deps,
        bearerConfig.adminUserId,
        BEARER_CLIENT_ID
      );
      return accessLevel
        ? authInfo(bearerToken, {
            userId: bearerConfig.adminUserId,
            accessLevel,
            clientId: BEARER_CLIENT_ID,
            authMode: "bearer",
          })
        : undefined;
    }

    const oauthConfig = deps.getOAuthConfig();
    if (
      !oauthConfig ||
      !adminUserIdSchema.safeParse(oauthConfig.adminUserId).success
    ) {
      reject("oauth_not_configured");
      return undefined;
    }

    const verified = await deps.verifyOAuthToken(bearerToken);
    if (!verified) {
      reject("invalid_token");
      return undefined;
    }

    const { claims, algorithm } = verified;
    if (algorithm !== REQUIRED_OAUTH_ALGORITHM) {
      reject("oauth_algorithm", { algorithm });
      return undefined;
    }
    if (claims.iss !== oauthConfig.issuer) {
      reject("oauth_issuer");
      return undefined;
    }
    if (claims.sub !== oauthConfig.adminUserId) {
      reject("oauth_subject", { clientId: claims.client_id });
      return undefined;
    }

    if (oauthConfig.dcrCanary) {
      if (
        !audienceIncludes(claims.aud, oauthConfig.resource) &&
        !audienceIncludes(claims.aud, SUPABASE_DEFAULT_AUDIENCE)
      ) {
        reject("oauth_audience", { clientId: claims.client_id });
        return undefined;
      }
    } else {
      const client = await deps.findOAuthClient(claims.client_id);
      if (
        !client?.enabled ||
        client.audience !== oauthConfig.resource ||
        !audienceIncludes(claims.aud, oauthConfig.resource)
      ) {
        reject("oauth_client_or_audience", { clientId: claims.client_id });
        return undefined;
      }
    }

    const accessLevel = await requireLiveAdmin(
      deps,
      claims.sub,
      claims.client_id
    );
    if (!accessLevel) return undefined;

    return authInfo(
      bearerToken,
      {
        userId: claims.sub,
        accessLevel,
        clientId: claims.client_id,
        authMode: "oauth",
      },
      claims.scope?.split(/\s+/).filter(Boolean) ?? [],
      claims.exp
    );
  };
}

export const verifyToken = createVerifyToken();

function isAccessLevel(value: unknown): value is AccessLevel {
  return (
    typeof value === "string" &&
    (ACCESS_LEVELS as readonly string[]).includes(value)
  );
}

export function requireMcpAuthContext(
  authInfoValue: AuthInfo | undefined
): McpAuthContext {
  const extra = authInfoValue?.extra;
  if (
    !extra ||
    typeof extra["userId"] !== "string" ||
    typeof extra["clientId"] !== "string" ||
    (extra["authMode"] !== "bearer" && extra["authMode"] !== "oauth") ||
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
    authMode: extra["authMode"],
  };
}
