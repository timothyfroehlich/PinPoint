import { beforeEach, describe, expect, it } from "vitest";

import { getSupabaseEnv } from "~/lib/supabase/env";

const envBackup = { ...process.env };

describe("getSupabaseEnv", () => {
  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
  });

  it("prefers NEXT_PUBLIC_SUPABASE_URL over SUPABASE_URL", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://public.example";
    process.env.SUPABASE_URL = "https://server.example";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1";

    expect(getSupabaseEnv().url).toBe("https://public.example");
  });

  it("prefers publishable/anon keys in documented precedence order", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://public.example";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_2";
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_3";
    process.env.SUPABASE_ANON_KEY = "anon_4";

    expect(getSupabaseEnv().publishableKey).toBe("sb_publishable_1");
  });

  it("falls back from NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to NEXT_PUBLIC_SUPABASE_ANON_KEY", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://public.example";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_2";

    expect(getSupabaseEnv().publishableKey).toBe("anon_2");
  });

  it("falls back to SUPABASE_PUBLISHABLE_KEY when NEXT_PUBLIC keys are not set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://public.example";
    process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_3";

    expect(getSupabaseEnv().publishableKey).toBe("sb_publishable_3");
  });

  it("throws when missing URL", () => {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1";

    expect(() => getSupabaseEnv()).toThrowError(/Missing Supabase env vars/);
  });

  it("throws when missing key", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://public.example";

    expect(() => getSupabaseEnv()).toThrowError(/Missing Supabase env vars/);
  });
});
