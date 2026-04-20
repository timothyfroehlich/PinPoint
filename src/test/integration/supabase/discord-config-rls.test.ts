import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars for Discord RLS tests.");
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

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
    await adminClient.auth.admin.deleteUser(adminUser.id);
    await adminClient.auth.admin.deleteUser(memberUser.id);
  });

  it("anonymous client cannot read the config", async () => {
    const { data } = await anonClient
      .from("discord_integration_config")
      .select("*");
    expect(data ?? []).toHaveLength(0);
  });

  it("member client cannot read the config", async () => {
    const { data } = await memberAuthedClient
      .from("discord_integration_config")
      .select("*");
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
      .update({ enabled: true })
      .eq("id", "singleton");
    // RLS returns no error but affects 0 rows; re-read to prove no mutation
    expect(error).toBeNull();
    const { data } = await adminClient
      .from("discord_integration_config")
      .select("enabled")
      .eq("id", "singleton")
      .single();
    expect(data?.enabled).toBe(false);
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

  it("service role can EXECUTE get_discord_config() and gets a row", async () => {
    const { data, error } = await adminClient.rpc("get_discord_config");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data?.length).toBe(1);
  });
});
