// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import OAuthConsentPage from "./page";

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

function mockSupabase(
  user: { id: string } | null,
  getAuthorizationDetails: ReturnType<typeof vi.fn> = vi.fn()
): void {
  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      oauth: { getAuthorizationDetails },
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

const params = (o: Record<string, string>): Promise<Record<string, string>> =>
  Promise.resolve(o);

describe("OAuthConsentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an error notice when authorization_id is missing", async () => {
    mockSupabase({ id: "u1" });
    getUserAccessLevelMock.mockResolvedValue("admin");

    render(await OAuthConsentPage({ searchParams: params({}) }));

    expect(
      screen.getByText("Invalid authorization request")
    ).toBeInTheDocument();
  });

  it("redirects unauthenticated users to login with encoded next", async () => {
    mockSupabase(null);

    await expect(
      OAuthConsentPage({ searchParams: params({ authorization_id: "a1" }) })
    ).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=%2Foauth%2Fconsent%3Fauthorization_id%3Da1"
    );
  });

  it("shows an admin-only notice for non-admins", async () => {
    mockSupabase({ id: "u2" });
    getUserAccessLevelMock.mockResolvedValue("technician");

    render(
      await OAuthConsentPage({
        searchParams: params({ authorization_id: "a1" }),
      })
    );

    expect(screen.getByText("Admin access required")).toBeInTheDocument();
  });

  it("redirects immediately when the user already consented", async () => {
    mockSupabase(
      { id: "u1" },
      vi.fn().mockResolvedValue({
        data: { redirect_url: "https://claude.ai/cb?code=xyz" },
        error: null,
      })
    );
    getUserAccessLevelMock.mockResolvedValue("admin");

    await expect(
      OAuthConsentPage({ searchParams: params({ authorization_id: "a1" }) })
    ).rejects.toThrow("NEXT_REDIRECT:https://claude.ai/cb?code=xyz");
  });

  it("renders an error notice when details fail to load", async () => {
    mockSupabase(
      { id: "u1" },
      vi.fn().mockResolvedValue({ data: null, error: new Error("expired") })
    );
    getUserAccessLevelMock.mockResolvedValue("admin");

    render(
      await OAuthConsentPage({
        searchParams: params({ authorization_id: "a1" }),
      })
    );

    expect(screen.getByText("Couldn't load this request")).toBeInTheDocument();
  });

  it("renders the consent form with client name, scopes, and redirect", async () => {
    mockSupabase(
      { id: "u1" },
      vi.fn().mockResolvedValue({
        data: {
          authorization_id: "a1",
          redirect_uri: "https://claude.ai/callback",
          client: {
            id: "c1",
            name: "Claude Code",
            uri: "https://claude.ai",
            logo_uri: "",
          },
          user: { id: "u1", email: "admin@example.com" },
          scope: "openid profile email",
        },
        error: null,
      })
    );
    getUserAccessLevelMock.mockResolvedValue("admin");

    render(
      await OAuthConsentPage({
        searchParams: params({ authorization_id: "a1" }),
      })
    );

    expect(
      screen.getByRole("heading", { name: /Authorize Claude Code/ })
    ).toBeInTheDocument();
    expect(screen.getByText("openid")).toBeInTheDocument();
    expect(screen.getByText("https://claude.ai/callback")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Authorize" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deny" })).toBeInTheDocument();
    // The hidden authorization_id travels with the approve form.
    expect(
      document.querySelector('input[name="authorization_id"][value="a1"]')
    ).not.toBeNull();
  });

  it("refuses when the authorization belongs to a different user", async () => {
    mockSupabase(
      { id: "u1" },
      vi.fn().mockResolvedValue({
        data: {
          authorization_id: "a1",
          redirect_uri: "https://claude.ai/callback",
          client: {
            id: "c1",
            name: "Claude Code",
            uri: "https://claude.ai",
            logo_uri: "",
          },
          user: { id: "someone-else", email: "other@example.com" },
          scope: "openid",
        },
        error: null,
      })
    );
    getUserAccessLevelMock.mockResolvedValue("admin");

    render(
      await OAuthConsentPage({
        searchParams: params({ authorization_id: "a1" }),
      })
    );

    expect(screen.getByText("Couldn't load this request")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Authorize" })
    ).not.toBeInTheDocument();
  });
});
