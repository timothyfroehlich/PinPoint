import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl =
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !databaseUrl) {
  throw new Error("Missing Supabase env vars for Discord RLS tests.");
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);
const anonClient = createClient(supabaseUrl, supabaseAnonKey);
// Direct SQL is required to reproduce Supabase re-granting EXECUTE to
// authenticated; the in-body guard must survive that state. prepare:false is
// safe on the local direct connection and required if this ever uses :6543.
const sql = postgres(databaseUrl, { prepare: false });

describe("Discord integration config RLS", () => {
  let adminUser: { id: string; email: string };
  let memberUser: { id: string; email: string };
  let adminAuthedClient: SupabaseClient;
  let memberAuthedClient: SupabaseClient;

  beforeAll(async () => {
    const adminEmail = `discord-rls-admin-${Date.now()}@test.com`;
    const { data: adminData } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: "TestPassword123",
      email_confirm: true,
      user_metadata: { first_name: "Admin", last_name: "Test", role: "admin" },
    });
    if (!adminData.user) throw new Error("admin user not created");
    adminUser = { id: adminData.user.id, email: adminEmail };
    await adminClient
      .from("user_profiles")
      .update({ role: "admin" })
      .eq("id", adminUser.id);

    const memberEmail = `discord-rls-member-${Date.now()}@test.com`;
    const { data: memberData } = await adminClient.auth.admin.createUser({
      email: memberEmail,
      password: "TestPassword123",
      email_confirm: true,
      user_metadata: {
        first_name: "Member",
        last_name: "Test",
        role: "member",
      },
    });
    if (!memberData.user) throw new Error("member user not created");
    memberUser = { id: memberData.user.id, email: memberEmail };

    adminAuthedClient = createClient(supabaseUrl, supabaseAnonKey);
    await adminAuthedClient.auth.signInWithPassword({
      email: adminEmail,
      password: "TestPassword123",
    });

    memberAuthedClient = createClient(supabaseUrl, supabaseAnonKey);
    await memberAuthedClient.auth.signInWithPassword({
      email: memberEmail,
      password: "TestPassword123",
    });
  });

  afterAll(async () => {
    try {
      await sql`REVOKE ALL ON FUNCTION public.get_discord_config() FROM anon, authenticated`;
      await adminClient.auth.admin.deleteUser(adminUser.id);
      await adminClient.auth.admin.deleteUser(memberUser.id);
    } finally {
      await sql.end();
    }
  });

  it("anonymous client cannot read the config", async () => {
    const { data, error } = await anonClient
      .from("discord_integration_config")
      .select("*");
    // RLS silently returns an empty result for non-matching callers, so
    // assert error is null AND the set is empty — otherwise the test would
    // falsely pass if the table were missing or misconfigured.
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("member client cannot read the config", async () => {
    const { data, error } = await memberAuthedClient
      .from("discord_integration_config")
      .select("*");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("admin client can read the config (sees singleton row)", async () => {
    const { data, error } = await adminAuthedClient
      .from("discord_integration_config")
      .select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe("singleton");
  });

  it("member client cannot UPDATE the config", async () => {
    const { error } = await memberAuthedClient
      .from("discord_integration_config")
      .update({ guild_id: "123456789012345678" })
      .eq("id", "singleton");
    // RLS returns no error but affects 0 rows; re-read to prove no mutation
    expect(error).toBeNull();
    const { data } = await adminClient
      .from("discord_integration_config")
      .select("guild_id")
      .eq("id", "singleton")
      .single();
    expect(data?.guild_id).toBeNull();
  });

  it("admin client can UPDATE the config", async () => {
    const { error } = await adminAuthedClient
      .from("discord_integration_config")
      .update({ guild_id: "test-guild-123" })
      .eq("id", "singleton");
    expect(error).toBeNull();
    const { data } = await adminClient
      .from("discord_integration_config")
      .select("guild_id")
      .eq("id", "singleton")
      .single();
    expect(data?.guild_id).toBe("test-guild-123");
    // cleanup
    await adminClient
      .from("discord_integration_config")
      .update({ guild_id: null })
      .eq("id", "singleton");
  });

  it("authenticated role cannot EXECUTE get_discord_config()", async () => {
    const { error } = await memberAuthedClient.rpc("get_discord_config");
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/permission|not.*found/i);
  });

  it("still refuses a member who has been granted EXECUTE", async () => {
    await sql`GRANT EXECUTE ON FUNCTION public.get_discord_config() TO authenticated`;
    try {
      const { data, error } =
        await memberAuthedClient.rpc("get_discord_config");
      expect(error).not.toBeNull();
      expect(error?.message ?? "").toMatch(/permission denied/i);
      expect(data ?? null).toBeNull();
    } finally {
      await sql`REVOKE ALL ON FUNCTION public.get_discord_config() FROM authenticated`;
    }
  });

  it("service role can EXECUTE get_discord_config() and gets a row", async () => {
    const { data, error } = await adminClient.rpc("get_discord_config");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data?.length).toBe(1);
    expect(data?.[0]).not.toHaveProperty("enabled");
    expect(data?.[0]).toHaveProperty("guild_id");
    expect(data?.[0]).toHaveProperty("bot_token");
  });
});
