import { afterEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn((): unknown => ({})),
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));

import { createAdminClient } from "./admin";

const ENV_KEYS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
] as const;

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const k of ENV_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(values)) process.env[k] = v;
}

afterEach(() => {
  setEnv({});
  createClientMock.mockClear();
});

describe("createAdminClient", () => {
  it("uses SUPABASE_SERVICE_ROLE_KEY when set", () => {
    setEnv({
      SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "legacy",
    });
    createAdminClient();
    expect(createClientMock).toHaveBeenCalledWith(
      "https://x.supabase.co",
      "legacy",
      expect.anything()
    );
  });

  it("falls back to SUPABASE_SECRET_KEY when service-role is unset", () => {
    setEnv({
      SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_new",
    });
    createAdminClient();
    expect(createClientMock).toHaveBeenCalledWith(
      "https://x.supabase.co",
      "sb_secret_new",
      expect.anything()
    );
  });

  it("throws when neither service-role nor secret key is set", () => {
    setEnv({ SUPABASE_URL: "https://x.supabase.co" });
    expect(() => createAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
