import { NextRequest } from "next/server";
import { describe, beforeEach, afterEach, it, expect, vi } from "vitest";

import { updateSession } from "./middleware";
import { createMockUser } from "~/test/helpers/mocks";

const createServerClientMock = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

const DEFAULT_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  DEV_AUTOLOGIN_EMAIL: "admin@test.com",
  DEV_AUTOLOGIN_PASSWORD: "TestPassword123",
};

const makeRequest = (url: string, headers?: Record<string, string>) =>
  new NextRequest(new URL(url), { headers });

const createSupabaseAuthMocks = (
  firstUser: object | null,
  secondUser: object | null = firstUser
) => {
  const getUser = vi
    .fn()
    .mockResolvedValueOnce({ data: { user: firstUser }, error: null })
    .mockResolvedValue({ data: { user: secondUser }, error: null });

  const signInWithPassword = vi.fn().mockResolvedValue({
    data: { user: secondUser, session: null },
    error: null,
  });

  const getSession = vi.fn().mockResolvedValue({
    data: { session: null },
    error: null,
  });

  return {
    auth: {
      getUser,
      signInWithPassword,
      getSession,
    },
  };
};

describe("updateSession autologin", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...envBackup,
      ...DEFAULT_ENV,
      DEV_AUTOLOGIN_ENABLED: "true",
    };
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("logs in automatically when enabled and unauthenticated", async () => {
    const user = createMockUser({ email: "admin@test.com" });
    const supabase = createSupabaseAuthMocks(null, user);
    createServerClientMock.mockReturnValue(supabase);

    const request = makeRequest("http://localhost/dashboard");
    const response = await updateSession(request);

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "admin@test.com",
      password: "TestPassword123",
    });
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(2);
    expect(response.headers.get("location")).toBeNull();
  });

  it("skips autologin when header requests it", async () => {
    const supabase = createSupabaseAuthMocks(null, null);
    createServerClientMock.mockReturnValue(supabase);

    const request = makeRequest("http://localhost/dashboard", {
      "x-skip-autologin": "true",
    });

    const response = await updateSession(request);

    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(response.headers.get("location")?.includes("/login")).toBe(true);
  });

  it("skips autologin when disabled via env", async () => {
    process.env.DEV_AUTOLOGIN_ENABLED = "false";
    const supabase = createSupabaseAuthMocks(null, null);
    createServerClientMock.mockReturnValue(supabase);

    const request = makeRequest("http://localhost/dashboard");
    const response = await updateSession(request);

    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(response.headers.get("location")?.includes("/login")).toBe(true);
  });

  it("skips autologin when query param disables it", async () => {
    const supabase = createSupabaseAuthMocks(null, null);
    createServerClientMock.mockReturnValue(supabase);

    const request = makeRequest("http://localhost/dashboard?autologin=off");
    const response = await updateSession(request);

    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(response.headers.get("location")?.includes("/login")).toBe(true);
  });

  it("skips autologin when cookie requests it", async () => {
    const supabase = createSupabaseAuthMocks(null, null);
    createServerClientMock.mockReturnValue(supabase);

    const request = makeRequest("http://localhost/dashboard");
    request.cookies.set("skip_autologin", "true");

    const response = await updateSession(request);

    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(response.headers.get("location")?.includes("/login")).toBe(true);
  });

  it("never attempts autologin in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.DEV_AUTOLOGIN_ENABLED = "true";

    const supabase = createSupabaseAuthMocks(null, null);
    createServerClientMock.mockReturnValue(supabase);

    const request = makeRequest("http://localhost/dashboard");
    await updateSession(request);

    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});
