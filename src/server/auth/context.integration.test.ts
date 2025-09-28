import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("~/lib/subdomain-verification", () => ({
  extractTrustedSubdomain: vi.fn(),
}));

vi.mock("~/lib/domain-org-mapping", () => ({
  resolveOrgSubdomainFromHost: vi.fn(),
}));

vi.mock("~/lib/dal/public-organizations", () => ({
  getOrganizationBySubdomain: vi.fn(),
  getUserMembershipPublic: vi.fn(),
  getPublicOrganizationById: vi.fn(),
}));

vi.doMock("~/server/auth/context", async () => {
  const actual = await vi.importActual<typeof import("~/server/auth/context")>(
    "~/server/auth/context",
  );
  return actual;
});

const { createClient } = await import("~/lib/supabase/server");
const { headers } = await import("next/headers");
const { extractTrustedSubdomain } = await import(
  "~/lib/subdomain-verification"
);
const { resolveOrgSubdomainFromHost } = await import(
  "~/lib/domain-org-mapping"
);
const {
  getOrganizationBySubdomain,
  getUserMembershipPublic,
  getPublicOrganizationById,
} = await import("~/lib/dal/public-organizations");

const { getRequestAuthContext, __resetAuthContextCache } = await import(
  "./context"
);

describe("getRequestAuthContext host + metadata precedence", () => {
  const supabase = {
    auth: {
      getUser: vi.fn(),
    },
  } as const;

  beforeEach(() => {
    __resetAuthContextCache();
    vi.mocked(createClient).mockResolvedValue(supabase as any);
    vi.mocked(headers).mockResolvedValue(new Headers({ host: "pinpoint.app" }));
    vi.mocked(extractTrustedSubdomain).mockReturnValue(null);
    vi.mocked(resolveOrgSubdomainFromHost).mockReturnValue(null);
    vi.mocked(getOrganizationBySubdomain).mockResolvedValue(null);
    vi.mocked(getUserMembershipPublic).mockResolvedValue(null);
    vi.mocked(getPublicOrganizationById).mockResolvedValue(null);
    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "user@example.com",
          app_metadata: { organizationId: "org-123" },
          user_metadata: {},
        },
      },
      error: null,
    });
  });

  it("returns authorized context using metadata when no host hint", async () => {
    vi.mocked(getPublicOrganizationById).mockResolvedValue({
      id: "org-123",
      subdomain: "apc",
      name: "Austin Pinball Collective",
    });
    vi.mocked(getUserMembershipPublic).mockResolvedValue({
      id: "membership-1",
      role: { id: "role-member", name: "Member" },
      user_id: "user-1",
      organization_id: "org-123",
    });

    const ctx = await getRequestAuthContext();

    expect(getPublicOrganizationById).toHaveBeenCalledWith("org-123");
    expect(getOrganizationBySubdomain).not.toHaveBeenCalled();
    expect(ctx.kind).toBe("authorized");
    if (ctx.kind === "authorized") {
      expect(ctx.org.id).toBe("org-123");
    }
  });

  it("uses host hint when metadata missing", async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-2",
          email: "user2@example.com",
          app_metadata: {},
          user_metadata: {},
        },
      },
      error: null,
    });

    vi.mocked(headers).mockResolvedValue(
      new Headers({ host: "apc.pinpoint.app" }),
    );
    vi.mocked(resolveOrgSubdomainFromHost).mockReturnValue("apc");
    vi.mocked(getOrganizationBySubdomain).mockResolvedValue({
      id: "org-apc",
      subdomain: "apc",
      name: "Austin Pinball Collective",
    });
    vi.mocked(getUserMembershipPublic).mockResolvedValue({
      id: "membership-2",
      role: { id: "role-member", name: "Member" },
      user_id: "user-2",
      organization_id: "org-apc",
    });

    const ctx = await getRequestAuthContext();

    expect(resolveOrgSubdomainFromHost).toHaveBeenCalled();
    expect(getOrganizationBySubdomain).toHaveBeenCalledWith("apc");
    expect(ctx.kind).toBe("authorized");
    if (ctx.kind === "authorized") {
      expect(ctx.org.id).toBe("org-apc");
    }
  });

  it("returns no-membership when user lacks membership for resolved org", async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-3",
          email: "user3@example.com",
          app_metadata: {},
          user_metadata: {},
        },
      },
      error: null,
    });

    vi.mocked(headers).mockResolvedValue(
      new Headers({ host: "apc.pinpoint.app" }),
    );
    vi.mocked(resolveOrgSubdomainFromHost).mockReturnValue("apc");
    vi.mocked(getOrganizationBySubdomain).mockResolvedValue({
      id: "org-apc",
      subdomain: "apc",
      name: "Austin Pinball Collective",
    });
    vi.mocked(getUserMembershipPublic).mockResolvedValue(null);

    const ctx = await getRequestAuthContext();

    expect(ctx.kind).toBe("no-membership");
    if (ctx.kind === "no-membership") {
      expect(ctx.orgId).toBe("org-apc");
    }
  });
});
