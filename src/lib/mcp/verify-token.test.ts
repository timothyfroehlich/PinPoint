import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getMcpOAuthConfigMock,
  getUserAccessLevelMock,
  verifySupabaseOAuthTokenMock,
  findMcpOAuthClientMock,
  warnMock,
} = vi.hoisted(() => ({
  getMcpOAuthConfigMock: vi.fn(),
  getUserAccessLevelMock: vi.fn(),
  verifySupabaseOAuthTokenMock: vi.fn(),
  findMcpOAuthClientMock: vi.fn(),
  warnMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: warnMock, error: vi.fn(), debug: vi.fn() },
}));
vi.mock("~/lib/permissions/access", () => ({
  getUserAccessLevel: getUserAccessLevelMock,
}));
vi.mock("~/lib/mcp/oauth", () => ({
  getMcpOAuthConfig: getMcpOAuthConfigMock,
  verifySupabaseOAuthToken: verifySupabaseOAuthTokenMock,
  findMcpOAuthClient: findMcpOAuthClientMock,
}));

import {
  createVerifyToken,
  requireMcpAuthContext,
  verifyToken,
  type McpBearerConfig,
  type VerifyTokenDeps,
} from "./verify-token";

const request = new Request("https://pinpoint.test/api/mcp/mcp");

/** 64 hex chars, matching what `openssl rand -hex 32` produces. */
const TOKEN = "a".repeat(64);
const ADMIN_USER_ID = "3fe49d22-af58-47ac-aecb-9345a882ba0c";
const OAUTH_TOKEN = "header.payload.signature";
const OAUTH_CLIENT_ID = "codex-client";
const RESOURCE = "https://pinpoint.test/api/mcp/mcp";
const ISSUER = "https://project.supabase.co/auth/v1";

const OAUTH_CONFIG = {
  issuer: ISSUER,
  resource: RESOURCE,
  adminUserId: ADMIN_USER_ID,
  dcrCanary: false,
};

const VERIFIED_OAUTH = {
  algorithm: "ES256",
  claims: {
    iss: ISSUER,
    aud: RESOURCE,
    exp: 2_000_000_000,
    sub: ADMIN_USER_ID,
    client_id: OAUTH_CLIENT_ID,
    scope: "openid email",
  },
};

function deps(overrides: Partial<VerifyTokenDeps> = {}): VerifyTokenDeps {
  return {
    getConfig: vi
      .fn<() => McpBearerConfig | undefined>()
      .mockReturnValue({ bearerToken: TOKEN, adminUserId: ADMIN_USER_ID }),
    getOAuthConfig: vi.fn().mockReturnValue(undefined),
    verifyOAuthToken: vi.fn().mockResolvedValue(undefined),
    findOAuthClient: vi.fn().mockResolvedValue(undefined),
    getUserAccessLevel: vi.fn().mockResolvedValue("admin"),
    ...overrides,
  };
}

// `vi.stubEnv` (rather than assigning to `process.env`) so `unstubAllEnvs`
// restores the ambient environment, and so `undefined` cleanly means "unset".
function setEnv(values: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(values)) {
    vi.stubEnv(key, value);
  }
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("createVerifyToken", () => {
  it("returns AuthInfo carrying the mapped admin identity for the right token", async () => {
    const verify = createVerifyToken(deps());

    const result = await verify(request, TOKEN);

    expect(result).toEqual({
      token: TOKEN,
      clientId: "claude-code-bearer",
      scopes: [],
      extra: {
        userId: ADMIN_USER_ID,
        accessLevel: "admin",
        clientId: "claude-code-bearer",
        authMode: "bearer",
      },
    });
  });

  it("rejects a wrong token without resolving an access level", async () => {
    const getUserAccessLevel = vi.fn();
    const verify = createVerifyToken(deps({ getUserAccessLevel }));

    const result = await verify(request, "b".repeat(64));

    expect(result).toBeUndefined();
    expect(getUserAccessLevel).not.toHaveBeenCalled();
  });

  it("rejects a token that is a prefix of the secret (no truncation match)", async () => {
    const verify = createVerifyToken(deps());

    expect(await verify(request, TOKEN.slice(0, 32))).toBeUndefined();
    expect(await verify(request, `${TOKEN}extra`)).toBeUndefined();
  });

  it("rejects a request with no bearer token", async () => {
    const getConfig = vi.fn();
    const verify = createVerifyToken(deps({ getConfig }));

    const result = await verify(request, undefined);

    expect(result).toBeUndefined();
    expect(getConfig).not.toHaveBeenCalled();
  });

  it("rejects when the server is not configured", async () => {
    const getUserAccessLevel = vi.fn();
    const verify = createVerifyToken(
      deps({ getConfig: () => undefined, getUserAccessLevel })
    );

    const result = await verify(request, TOKEN);

    expect(result).toBeUndefined();
    expect(getUserAccessLevel).not.toHaveBeenCalled();
  });

  it("rejects when the mapped user is no longer an admin", async () => {
    const getUserAccessLevel = vi.fn().mockResolvedValue("technician");
    const verify = createVerifyToken(deps({ getUserAccessLevel }));

    const result = await verify(request, TOKEN);

    expect(result).toBeUndefined();
    expect(getUserAccessLevel).toHaveBeenCalledWith(ADMIN_USER_ID);
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "not_admin",
        accessLevel: "technician",
      }),
      expect.any(String)
    );
  });

  it("admits a registered ES256 OAuth client with the exact resource audience", async () => {
    const verify = createVerifyToken(
      deps({
        getConfig: () => undefined,
        getOAuthConfig: () => OAUTH_CONFIG,
        verifyOAuthToken: vi.fn().mockResolvedValue(VERIFIED_OAUTH),
        findOAuthClient: vi.fn().mockResolvedValue({
          clientId: OAUTH_CLIENT_ID,
          audience: RESOURCE,
          enabled: true,
        }),
      })
    );

    const result = await verify(request, OAUTH_TOKEN);

    expect(result).toEqual({
      token: OAUTH_TOKEN,
      clientId: OAUTH_CLIENT_ID,
      scopes: ["openid", "email"],
      expiresAt: 2_000_000_000,
      extra: {
        userId: ADMIN_USER_ID,
        accessLevel: "admin",
        clientId: OAUTH_CLIENT_ID,
        authMode: "oauth",
      },
    });
  });

  it.each([
    ["the wrong algorithm", { algorithm: "HS256" }],
    [
      "the wrong issuer",
      {
        claims: { ...VERIFIED_OAUTH.claims, iss: "https://other.test/auth/v1" },
      },
    ],
    [
      "another subject",
      {
        claims: {
          ...VERIFIED_OAUTH.claims,
          sub: "11111111-1111-4111-8111-111111111111",
        },
      },
    ],
    [
      "the wrong audience",
      { claims: { ...VERIFIED_OAUTH.claims, aud: "authenticated" } },
    ],
  ])("rejects an OAuth token with %s", async (_label, override) => {
    const verify = createVerifyToken(
      deps({
        getConfig: () => undefined,
        getOAuthConfig: () => OAUTH_CONFIG,
        verifyOAuthToken: vi
          .fn()
          .mockResolvedValue({ ...VERIFIED_OAUTH, ...override }),
        findOAuthClient: vi.fn().mockResolvedValue({
          clientId: OAUTH_CLIENT_ID,
          audience: RESOURCE,
          enabled: true,
        }),
      })
    );

    expect(await verify(request, OAUTH_TOKEN)).toBeUndefined();
  });

  it("rejects an unregistered OAuth client outside the DCR canary", async () => {
    const verify = createVerifyToken(
      deps({
        getConfig: () => undefined,
        getOAuthConfig: () => OAUTH_CONFIG,
        verifyOAuthToken: vi.fn().mockResolvedValue(VERIFIED_OAUTH),
      })
    );

    expect(await verify(request, OAUTH_TOKEN)).toBeUndefined();
  });

  it("accepts Tim's unregistered default-audience token only during the DCR canary", async () => {
    const verify = createVerifyToken(
      deps({
        getConfig: () => undefined,
        getOAuthConfig: () => ({ ...OAUTH_CONFIG, dcrCanary: true }),
        verifyOAuthToken: vi.fn().mockResolvedValue({
          ...VERIFIED_OAUTH,
          claims: { ...VERIFIED_OAUTH.claims, aud: "authenticated" },
        }),
      })
    );

    expect((await verify(request, OAUTH_TOKEN))?.extra).toMatchObject({
      authMode: "oauth",
      clientId: OAUTH_CLIENT_ID,
    });
  });
});

describe("verifyToken (default env-backed config)", () => {
  beforeEach(() => {
    setEnv({ MCP_BEARER_TOKEN: TOKEN, MCP_ADMIN_USER_ID: ADMIN_USER_ID });
    getMcpOAuthConfigMock.mockReturnValue(undefined);
    verifySupabaseOAuthTokenMock.mockResolvedValue(undefined);
    findMcpOAuthClientMock.mockResolvedValue(undefined);
  });

  it("admits the configured token and acts as the configured admin", async () => {
    getUserAccessLevelMock.mockResolvedValue("admin");

    const result = await verifyToken(request, TOKEN);

    expect(getUserAccessLevelMock).toHaveBeenCalledWith(ADMIN_USER_ID);
    expect(result?.extra).toEqual({
      userId: ADMIN_USER_ID,
      accessLevel: "admin",
      clientId: "claude-code-bearer",
      authMode: "bearer",
    });
  });

  it("fails closed when MCP_BEARER_TOKEN is unset", async () => {
    setEnv({ MCP_BEARER_TOKEN: undefined });

    const result = await verifyToken(request, TOKEN);

    expect(result).toBeUndefined();
    expect(getUserAccessLevelMock).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "oauth_not_configured" }),
      expect.any(String)
    );
  });

  it("fails closed when MCP_ADMIN_USER_ID is unset", async () => {
    setEnv({ MCP_ADMIN_USER_ID: undefined });

    const result = await verifyToken(request, TOKEN);

    expect(result).toBeUndefined();
    expect(getUserAccessLevelMock).not.toHaveBeenCalled();
  });

  it("rejects a too-short MCP_BEARER_TOKEN rather than guarding with a weak secret", async () => {
    const weak = "hunter2";
    setEnv({ MCP_BEARER_TOKEN: weak });

    const result = await verifyToken(request, weak);

    expect(result).toBeUndefined();
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "bearer_token_too_short" }),
      expect.any(String)
    );
  });

  it("rejects a non-UUID MCP_ADMIN_USER_ID before it reaches the uuid column", async () => {
    setEnv({ MCP_ADMIN_USER_ID: "tim" });

    const result = await verifyToken(request, TOKEN);

    expect(result).toBeUndefined();
    expect(getUserAccessLevelMock).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "admin_user_id_not_uuid" }),
      expect.any(String)
    );
  });

  it("rejects a wrong token", async () => {
    const result = await verifyToken(request, "c".repeat(64));

    expect(result).toBeUndefined();
    expect(getUserAccessLevelMock).not.toHaveBeenCalled();
  });
});

describe("requireMcpAuthContext", () => {
  it("returns the context from a well-formed authInfo", () => {
    const ctx = requireMcpAuthContext({
      token: "t",
      clientId: "claude-code-bearer",
      scopes: [],
      extra: {
        userId: "u",
        accessLevel: "admin",
        clientId: "claude-code-bearer",
        authMode: "bearer",
      },
    });

    expect(ctx).toEqual({
      userId: "u",
      accessLevel: "admin",
      clientId: "claude-code-bearer",
      authMode: "bearer",
    });
  });

  it("throws when authInfo is missing (tool reached without withMcpAuth)", () => {
    expect(() => requireMcpAuthContext(undefined)).toThrow(/auth context/);
  });

  it("throws when the access level is not a known level", () => {
    expect(() =>
      requireMcpAuthContext({
        token: "t",
        clientId: "c",
        scopes: [],
        extra: { userId: "u", accessLevel: "superuser", clientId: "c" },
      })
    ).toThrow(/auth context/);
  });
});
