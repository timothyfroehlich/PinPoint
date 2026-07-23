import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { z } from "zod";

import { log } from "~/lib/logger";
import { getUserAccessLevel } from "~/lib/permissions/access";
import { ACCESS_LEVELS, type AccessLevel } from "~/lib/permissions/matrix";

/**
 * The minimum access level the bearer-mapped user must hold to reach ANY MCP
 * tool.
 *
 * Re-checked on every request rather than baked into the token: if the mapped
 * user's role is ever demoted, the token stops working immediately. Per-tool
 * `checkPermission()` still runs underneath each tool as defense in depth — the
 * admin gate is not a substitute for it.
 */
const REQUIRED_ACCESS_LEVEL: AccessLevel = "admin";

/**
 * Minimum accepted length for `MCP_BEARER_TOKEN`. `openssl rand -hex 32` (the
 * documented way to generate it) yields 64 chars; this rejects a hand-typed
 * weak secret at startup-of-request rather than letting it quietly guard a
 * write-capable production surface.
 */
const MIN_BEARER_TOKEN_LENGTH = 32;

/**
 * Synthetic `client_id` recorded for every bearer-authenticated call. There is
 * no OAuth client registration behind a static token, but the audit trail
 * (`logMcpToolCall`) and {@link McpAuthContext} both want a stable identifier
 * for how the caller got in.
 */
const BEARER_CLIENT_ID = "claude-code-bearer";

const adminUserIdSchema = z.string().uuid();

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
  /** How the caller authenticated. Always {@link BEARER_CLIENT_ID} today. */
  clientId: string;
}

/**
 * The two env vars that configure bearer auth, resolved together so a partial
 * configuration fails closed instead of half-working.
 */
export interface McpBearerConfig {
  /** Shared secret the client must present as `Authorization: Bearer …`. */
  bearerToken: string;
  /** Supabase user UUID that every MCP tool call acts as. */
  adminUserId: string;
}

export interface VerifyTokenDeps {
  /**
   * Read the bearer configuration. Returns `undefined` when either var is
   * missing or malformed — the caller then rejects the request (fail closed).
   * Injectable so unit tests stay hermetic and don't mutate `process.env`.
   */
  getConfig: () => McpBearerConfig | undefined;
  getUserAccessLevel: (userId: string) => Promise<AccessLevel>;
}

/**
 * Default configuration source: `MCP_BEARER_TOKEN` + `MCP_ADMIN_USER_ID` from
 * the environment (CORE-SEC-009 — both registered in the `next.config.ts` build
 * registry, neither reused as another var's fallback, neither `NEXT_PUBLIC_`).
 *
 * Every rejection here is a deployment misconfiguration, so it warns loudly
 * rather than failing silently — the resulting 401 would otherwise be
 * indistinguishable from a wrong token.
 */
function readConfigFromEnv(): McpBearerConfig | undefined {
  const bearerToken = process.env["MCP_BEARER_TOKEN"];
  const adminUserId = process.env["MCP_ADMIN_USER_ID"];

  if (!bearerToken || !adminUserId) {
    log.warn(
      {
        scope: "mcp.auth",
        outcome: "rejected",
        reason: "not_configured",
        hasBearerToken: Boolean(bearerToken),
        hasAdminUserId: Boolean(adminUserId),
      },
      "mcp.auth rejected"
    );
    return undefined;
  }

  if (bearerToken.length < MIN_BEARER_TOKEN_LENGTH) {
    log.warn(
      {
        scope: "mcp.auth",
        outcome: "rejected",
        reason: "bearer_token_too_short",
        minLength: MIN_BEARER_TOKEN_LENGTH,
      },
      "mcp.auth rejected"
    );
    return undefined;
  }

  // The mapped id goes into a `uuid` column lookup; a malformed value would
  // surface as a Postgres cast error (500) instead of a clean 401.
  if (!adminUserIdSchema.safeParse(adminUserId).success) {
    log.warn(
      {
        scope: "mcp.auth",
        outcome: "rejected",
        reason: "admin_user_id_not_uuid",
      },
      "mcp.auth rejected"
    );
    return undefined;
  }

  return { bearerToken, adminUserId };
}

const defaultDeps: VerifyTokenDeps = {
  getConfig: readConfigFromEnv,
  getUserAccessLevel,
};

/**
 * Compare two secrets without leaking their contents through timing.
 *
 * Hashing first is what makes this safe: `timingSafeEqual` throws on
 * mismatched buffer lengths, so comparing the raw strings would both crash and
 * leak the secret's length. Fixed-width SHA-256 digests sidestep the
 * length-based early return entirely.
 */
function secretsMatch(presented: string, expected: string): boolean {
  const digest = (value: string): Buffer =>
    createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(presented), digest(expected));
}

/**
 * Build the `verifyToken` callback for `withMcpAuth`.
 *
 * Flow: extract bearer → constant-time compare against `MCP_BEARER_TOKEN` →
 * resolve `MCP_ADMIN_USER_ID`'s access level → require
 * {@link REQUIRED_ACCESS_LEVEL} → hand back an {@link AuthInfo} whose `extra`
 * carries the {@link McpAuthContext}. Any failure (missing token, wrong token,
 * unconfigured server, non-admin mapped user) returns `undefined`, which
 * `withMcpAuth` turns into a 401.
 *
 * Security posture: a static bearer token is a long-lived admin secret, chosen
 * deliberately for this private single-user server (see
 * `docs/plans/2026-07-22-mcp-bearer-token-pivot-handoff.md`). It is
 * server-only, HTTPS-only, hashed before comparison, fails closed when unset,
 * and re-checks the mapped user's role on every call. Rotate by changing the
 * env var.
 */
export function createVerifyToken(deps: VerifyTokenDeps = defaultDeps) {
  return async function verifyToken(
    _request: Request,
    bearerToken?: string
  ): Promise<AuthInfo | undefined> {
    if (!bearerToken) {
      return undefined;
    }

    const config = deps.getConfig();
    if (!config) {
      return undefined;
    }

    if (!secretsMatch(bearerToken, config.bearerToken)) {
      log.warn(
        {
          scope: "mcp.auth",
          outcome: "rejected",
          reason: "bad_token",
        },
        "mcp.auth rejected"
      );
      return undefined;
    }

    const { adminUserId } = config;
    const accessLevel = await deps.getUserAccessLevel(adminUserId);
    if (accessLevel !== REQUIRED_ACCESS_LEVEL) {
      // The token is right but the user it maps to is no longer an admin (or
      // never was). This is a write-capable production surface — a denied admin
      // gate is audit-worthy.
      log.warn(
        {
          scope: "mcp.auth",
          outcome: "rejected",
          reason: "not_admin",
          userId: adminUserId,
          clientId: BEARER_CLIENT_ID,
          accessLevel,
        },
        "mcp.auth rejected"
      );
      return undefined;
    }

    return {
      token: bearerToken,
      clientId: BEARER_CLIENT_ID,
      scopes: [],
      extra: {
        userId: adminUserId,
        accessLevel,
        clientId: BEARER_CLIENT_ID,
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
