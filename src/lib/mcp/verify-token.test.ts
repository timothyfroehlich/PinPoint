import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUserAccessLevelMock, warnMock } = vi.hoisted(() => ({
  getUserAccessLevelMock: vi.fn(),
  warnMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: warnMock, error: vi.fn(), debug: vi.fn() },
}));
vi.mock("~/lib/permissions/access", () => ({
  getUserAccessLevel: getUserAccessLevelMock,
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

function deps(overrides: Partial<VerifyTokenDeps> = {}): VerifyTokenDeps {
  return {
    getConfig: vi
      .fn<() => McpBearerConfig | undefined>()
      .mockReturnValue({ bearerToken: TOKEN, adminUserId: ADMIN_USER_ID }),
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
});

describe("verifyToken (default env-backed config)", () => {
  beforeEach(() => {
    setEnv({ MCP_BEARER_TOKEN: TOKEN, MCP_ADMIN_USER_ID: ADMIN_USER_ID });
  });

  it("admits the configured token and acts as the configured admin", async () => {
    getUserAccessLevelMock.mockResolvedValue("admin");

    const result = await verifyToken(request, TOKEN);

    expect(getUserAccessLevelMock).toHaveBeenCalledWith(ADMIN_USER_ID);
    expect(result?.extra).toEqual({
      userId: ADMIN_USER_ID,
      accessLevel: "admin",
      clientId: "claude-code-bearer",
    });
  });

  it("fails closed when MCP_BEARER_TOKEN is unset", async () => {
    setEnv({ MCP_BEARER_TOKEN: undefined });

    const result = await verifyToken(request, TOKEN);

    expect(result).toBeUndefined();
    expect(getUserAccessLevelMock).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "not_configured" }),
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
      },
    });

    expect(ctx).toEqual({
      userId: "u",
      accessLevel: "admin",
      clientId: "claude-code-bearer",
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
