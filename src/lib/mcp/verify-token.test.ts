import { afterEach, describe, expect, it, vi } from "vitest";

const { createClientMock, getClaimsMock, getUserAccessLevelMock } = vi.hoisted(
  () => ({
    createClientMock: vi.fn(),
    getClaimsMock: vi.fn(),
    getUserAccessLevelMock: vi.fn(),
  })
);

vi.mock("server-only", () => ({}));
vi.mock("~/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));
vi.mock("~/lib/permissions/access", () => ({
  getUserAccessLevel: getUserAccessLevelMock,
}));

import {
  createVerifyToken,
  requireMcpAuthContext,
  verifyToken,
  type VerifyTokenDeps,
} from "./verify-token";

const request = new Request("https://pinpoint.test/api/mcp/mcp");

// Bracket access via a variable key keeps the `dot-notation` rule (which the
// tests tsconfig applies to `process.env` string literals) from firing.
function setSupabaseEnv(): void {
  const env: Record<string, string> = {
    NEXT_PUBLIC_SUPABASE_URL: "https://ref.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  };
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
}

function deps(overrides: Partial<VerifyTokenDeps> = {}): VerifyTokenDeps {
  return {
    verifyClaims: vi.fn().mockResolvedValue({
      userId: "user-1",
      clientId: "claude-code",
    }),
    getUserAccessLevel: vi.fn().mockResolvedValue("admin"),
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("createVerifyToken", () => {
  it("returns AuthInfo carrying the resolved context for a valid admin token", async () => {
    const verify = createVerifyToken(deps());

    const result = await verify(request, "good.admin.jwt");

    expect(result).toEqual({
      token: "good.admin.jwt",
      clientId: "claude-code",
      scopes: [],
      extra: {
        userId: "user-1",
        accessLevel: "admin",
        clientId: "claude-code",
      },
    });
  });

  it("rejects a valid token whose user is not an admin", async () => {
    const getUserAccessLevel = vi.fn().mockResolvedValue("technician");
    const verify = createVerifyToken(deps({ getUserAccessLevel }));

    const result = await verify(request, "good.tech.jwt");

    expect(result).toBeUndefined();
    expect(getUserAccessLevel).toHaveBeenCalledWith("user-1");
  });

  it("rejects a garbage / expired token (claims fail verification)", async () => {
    const verifyClaims = vi.fn().mockResolvedValue(null);
    const getUserAccessLevel = vi.fn();
    const verify = createVerifyToken(
      deps({ verifyClaims, getUserAccessLevel })
    );

    const result = await verify(request, "garbage");

    expect(result).toBeUndefined();
    // Never resolves an access level for an unverifiable token.
    expect(getUserAccessLevel).not.toHaveBeenCalled();
  });

  it("rejects a request with no bearer token", async () => {
    const verifyClaims = vi.fn();
    const verify = createVerifyToken(deps({ verifyClaims }));

    const result = await verify(request, undefined);

    expect(result).toBeUndefined();
    expect(verifyClaims).not.toHaveBeenCalled();
  });
});

describe("verifyToken (default Supabase boundary)", () => {
  function mockGetClaims(): void {
    createClientMock.mockReturnValue({ auth: { getClaims: getClaimsMock } });
  }

  it("verifies via supabase.auth.getClaims and admits an admin", async () => {
    setSupabaseEnv();
    mockGetClaims();
    getClaimsMock.mockResolvedValue({
      data: { claims: { sub: "user-42", client_id: "claude-code" } },
      error: null,
    });
    getUserAccessLevelMock.mockResolvedValue("admin");

    const result = await verifyToken(request, "real.jwt");

    expect(getClaimsMock).toHaveBeenCalledWith("real.jwt");
    expect(result?.extra).toEqual({
      userId: "user-42",
      accessLevel: "admin",
      clientId: "claude-code",
    });
  });

  it("rejects when getClaims returns an error", async () => {
    setSupabaseEnv();
    mockGetClaims();
    getClaimsMock.mockResolvedValue({
      data: null,
      error: { name: "AuthError", message: "invalid JWT" },
    });

    const result = await verifyToken(request, "expired.jwt");

    expect(result).toBeUndefined();
    expect(getUserAccessLevelMock).not.toHaveBeenCalled();
  });

  it("rejects a token missing a sub claim", async () => {
    setSupabaseEnv();
    mockGetClaims();
    getClaimsMock.mockResolvedValue({
      data: { claims: { client_id: "claude-code" } },
      error: null,
    });

    const result = await verifyToken(request, "no.sub.jwt");

    expect(result).toBeUndefined();
    expect(getUserAccessLevelMock).not.toHaveBeenCalled();
  });
});

describe("requireMcpAuthContext", () => {
  it("returns the context from a well-formed authInfo", () => {
    const ctx = requireMcpAuthContext({
      token: "t",
      clientId: "claude-code",
      scopes: [],
      extra: { userId: "u", accessLevel: "admin", clientId: "claude-code" },
    });

    expect(ctx).toEqual({
      userId: "u",
      accessLevel: "admin",
      clientId: "claude-code",
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
