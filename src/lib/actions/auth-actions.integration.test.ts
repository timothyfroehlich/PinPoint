import { describe, expect, beforeEach, afterEach, it, vi } from "vitest";

import { sendMagicLink, signInWithOAuth } from "./auth-actions";

vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("~/lib/dal/public-organizations", () => ({
  validateOrganizationExists: vi.fn(),
  getOrganizationSubdomainById: vi.fn(),
}));

vi.mock("~/lib/environment", () => ({
  isDevelopment: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

const ALIAS_HOST = "pinpoint.austinpinballcollective.org";
const APEX_HOST = "pinpoint.app";
const PREVIEW_HOST = "pin-point-abc123.vercel.app";
const LOCAL_HOST = "localhost:3000";

const { createClient } = await import("~/lib/supabase/server");
const {
  validateOrganizationExists,
  getOrganizationSubdomainById,
} = await import("~/lib/dal/public-organizations");
const { isDevelopment } = await import("~/lib/environment");
const { headers } = await import("next/headers");

describe("auth-actions host handling", () => {
  const mockSupabase = {
    auth: {
      signInWithOtp: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  } as const;

  beforeEach(() => {
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
    vi.mocked(validateOrganizationExists).mockResolvedValue(true);
    vi.mocked(getOrganizationSubdomainById).mockResolvedValue("apc");
    vi.mocked(isDevelopment).mockReturnValue(false);
    vi.mocked(headers).mockResolvedValue(new Headers({ host: APEX_HOST }));

    mockSupabase.auth.signInWithOtp.mockResolvedValue({ error: null });
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { url: "https://supabase.example.com" },
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("sendMagicLink", () => {
    const email = "user@example.com";
    const organizationId = "org-apc";

    async function trigger(host: string): Promise<void> {
      vi.mocked(headers).mockResolvedValue(new Headers({ host }));

      const formData = new FormData();
      formData.set("email", email);
      formData.set("organizationId", organizationId);

      await sendMagicLink(null, formData);
    }

    it("keeps alias host in callback URL", async () => {
      await trigger(ALIAS_HOST);

      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          options: expect.objectContaining({
            emailRedirectTo:
              "https://pinpoint.austinpinballcollective.org/auth/callback?organizationId=org-apc",
          }),
        }),
      );
    });

    it("builds subdomain callback for apex host", async () => {
      await trigger(APEX_HOST);

      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            emailRedirectTo:
              "https://apc.pinpoint.app/auth/callback?organizationId=org-apc",
          }),
        }),
      );
    });

    it("keeps preview host for callbacks", async () => {
      await trigger(PREVIEW_HOST);

      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            emailRedirectTo:
              "https://pin-point-abc123.vercel.app/auth/callback?organizationId=org-apc",
          }),
        }),
      );
    });

    it("includes port for localhost", async () => {
      vi.mocked(isDevelopment).mockReturnValue(true);
      await trigger(LOCAL_HOST);

      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            emailRedirectTo:
              "https://apc.localhost:3000/auth/callback?organizationId=org-apc",
          }),
        }),
      );
    });
  });

  describe("signInWithOAuth", () => {
    const organizationId = "org-apc";

    async function trigger(host: string, redirectTo?: string): Promise<void> {
      vi.mocked(headers).mockResolvedValue(new Headers({ host }));

      await signInWithOAuth("google", organizationId, redirectTo);
    }

    it("keeps alias host in redirectTo", async () => {
      await trigger(ALIAS_HOST);

      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            redirectTo:
              "https://pinpoint.austinpinballcollective.org/auth/callback?organizationId=org-apc",
          }),
        }),
      );
    });

    it("builds subdomain redirect for apex host", async () => {
      await trigger(APEX_HOST, "/dashboard");

      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            redirectTo:
              "https://apc.pinpoint.app/auth/callback?organizationId=org-apc&next=%2Fdashboard",
          }),
        }),
      );
    });

    it("keeps preview host for redirect", async () => {
      await trigger(PREVIEW_HOST);

      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            redirectTo:
              "https://pin-point-abc123.vercel.app/auth/callback?organizationId=org-apc",
          }),
        }),
      );
    });

    it("includes port for localhost when in development", async () => {
      vi.mocked(isDevelopment).mockReturnValue(true);
      await trigger(LOCAL_HOST);

      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            redirectTo:
              "https://apc.localhost:3000/auth/callback?organizationId=org-apc",
          }),
        }),
      );
    });
  });
});

