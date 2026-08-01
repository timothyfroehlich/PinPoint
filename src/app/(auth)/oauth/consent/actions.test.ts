import { describe, expect, it, vi, beforeEach } from "vitest";

import { approveConsentAction, denyConsentAction } from "./actions";

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("~/lib/permissions/access", () => ({
  getUserAccessLevel: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("~/lib/logger", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { createClient } from "~/lib/supabase/server";
import { getUserAccessLevel } from "~/lib/permissions/access";

const createClientMock = vi.mocked(createClient);
const getUserAccessLevelMock = vi.mocked(getUserAccessLevel);

interface OAuthApi {
  approveAuthorization: ReturnType<typeof vi.fn>;
  denyAuthorization: ReturnType<typeof vi.fn>;
}

function mockSupabase(
  user: { id: string } | null,
  oauth: Partial<OAuthApi> = {}
): OAuthApi {
  const api: OAuthApi = {
    approveAuthorization: vi.fn(),
    denyAuthorization: vi.fn(),
    ...oauth,
  };
  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      oauth: api,
    },
    // Only the fields the action touches are needed.
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return api;
}

function formData(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

async function expectRedirect(
  fn: () => Promise<unknown>,
  expected: string
): Promise<void> {
  await expect(fn()).rejects.toThrow(`NEXT_REDIRECT:${expected}`);
}

describe("oauth consent actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approve: admin → approveAuthorization then redirect to redirect_url", async () => {
    const api = mockSupabase(
      { id: "u1" },
      {
        approveAuthorization: vi.fn().mockResolvedValue({
          data: { redirect_url: "https://claude.ai/cb?code=xyz&state=s" },
          error: null,
        }),
      }
    );
    getUserAccessLevelMock.mockResolvedValue("admin");

    await expectRedirect(
      () => approveConsentAction(formData({ authorization_id: "auth-123" })),
      "https://claude.ai/cb?code=xyz&state=s"
    );
    expect(api.approveAuthorization).toHaveBeenCalledWith("auth-123", {
      skipBrowserRedirect: true,
    });
    expect(api.denyAuthorization).not.toHaveBeenCalled();
  });

  it("deny: admin → denyAuthorization then redirect to redirect_url", async () => {
    const api = mockSupabase(
      { id: "u1" },
      {
        denyAuthorization: vi.fn().mockResolvedValue({
          data: { redirect_url: "https://claude.ai/cb?error=access_denied" },
          error: null,
        }),
      }
    );
    getUserAccessLevelMock.mockResolvedValue("admin");

    await expectRedirect(
      () => denyConsentAction(formData({ authorization_id: "auth-123" })),
      "https://claude.ai/cb?error=access_denied"
    );
    expect(api.denyAuthorization).toHaveBeenCalledWith("auth-123", {
      skipBrowserRedirect: true,
    });
  });

  it("missing authorization_id → redirect to /oauth/consent", async () => {
    mockSupabase({ id: "u1" });
    getUserAccessLevelMock.mockResolvedValue("admin");

    await expectRedirect(
      () => approveConsentAction(formData({})),
      "/oauth/consent"
    );
  });

  it("unauthenticated → redirect to login with encoded next", async () => {
    mockSupabase(null);

    await expectRedirect(
      () => approveConsentAction(formData({ authorization_id: "auth-123" })),
      "/login?next=%2Foauth%2Fconsent%3Fauthorization_id%3Dauth-123"
    );
  });

  it("non-admin → redirect back to consent page (no error flag)", async () => {
    const api = mockSupabase({ id: "u2" });
    getUserAccessLevelMock.mockResolvedValue("technician");

    await expectRedirect(
      () => approveConsentAction(formData({ authorization_id: "auth-123" })),
      "/oauth/consent?authorization_id=auth-123"
    );
    expect(api.approveAuthorization).not.toHaveBeenCalled();
  });

  it("approve error → redirect back to the consent page", async () => {
    mockSupabase(
      { id: "u1" },
      {
        approveAuthorization: vi.fn().mockResolvedValue({
          data: null,
          error: new Error("expired"),
        }),
      }
    );
    getUserAccessLevelMock.mockResolvedValue("admin");

    await expectRedirect(
      () => approveConsentAction(formData({ authorization_id: "auth-123" })),
      "/oauth/consent?authorization_id=auth-123"
    );
  });
});
