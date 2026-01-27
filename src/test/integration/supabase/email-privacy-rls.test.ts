import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Integration tests for Email Privacy Row Level Security (RLS)
 *
 * These tests verify that:
 * 1. Administrators can see all emails in public_profiles_view.
 * 2. Members can ONLY see their own email in public_profiles_view.
 * 3. Anonymous users cannot see any emails.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars for RLS tests");
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

describe("Email Privacy RLS Integration", () => {
  let adminUser: { id: string; email: string };
  let memberUser: { id: string; email: string };
  let memberClient: SupabaseClient;

  beforeAll(async () => {
    // 1. Create Admin User
    const adminEmail = `rls-admin-${Date.now()}@test.com`;
    const { data: adminData } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: "TestPassword123",
      email_confirm: true,
      user_metadata: {
        first_name: "RLS",
        last_name: "Admin",
        role: "admin", // CRITICAL: Used by get_my_role()
      },
    });
    adminUser = { id: adminData.user!.id, email: adminEmail };

    // Also sync to user_profiles table for foreign keys and view consistency
    await adminClient
      .from("user_profiles")
      .update({ role: "admin" })
      .eq("id", adminUser.id);

    // 2. Create Member User
    const memberEmail = `rls-member-${Date.now()}@test.com`;
    const { data: memberData } = await adminClient.auth.admin.createUser({
      email: memberEmail,
      password: "TestPassword123",
      email_confirm: true,
      user_metadata: {
        first_name: "RLS",
        last_name: "Member",
        role: "member", // CRITICAL: Used by get_my_role()
      },
    });
    memberUser = { id: memberData.user!.id, email: memberEmail };

    // 3. Create a client authenticated as the member
    memberClient = createClient(supabaseUrl, supabaseAnonKey);
    await memberClient.auth.signInWithPassword({
      email: memberEmail,
      password: "TestPassword123",
    });
  });

  afterAll(async () => {
    await adminClient.auth.admin.deleteUser(adminUser.id);
    await adminClient.auth.admin.deleteUser(memberUser.id);
  });

  it("Administrator can see all email addresses", async () => {
    // We use the adminClient (service_role) which bypasses RLS,
    // but the policy itself uses user_profiles role check.
    // To test the policy correctly, we need a client authenticated as the admin.
    const authenticatedAdminClient = createClient(supabaseUrl, supabaseAnonKey);
    await authenticatedAdminClient.auth.signInWithPassword({
      email: adminUser.email,
      password: "TestPassword123",
    });

    const { data, error } = await authenticatedAdminClient
      .from("public_profiles_view")
      .select("id, email");

    expect(error).toBeNull();
    const adminRecord = data?.find((r) => r.id === adminUser.id);
    const memberRecord = data?.find((r) => r.id === memberUser.id);

    expect(adminRecord?.email).toBe(adminUser.email);
    expect(memberRecord?.email).toBe(memberUser.email);
  });

  it("Member can ONLY see their own email address", async () => {
    const { data, error } = await memberClient
      .from("public_profiles_view")
      .select("id, email");

    expect(error).toBeNull();
    const myRecord = data?.find((r) => r.id === memberUser.id);
    const otherRecord = data?.find((r) => r.id === adminUser.id);

    // Should see own email
    expect(myRecord?.email).toBe(memberUser.email);
    // Should NOT see other's email (masked to null by view)
    expect(otherRecord?.email).toBeNull();
  });

  it("Anonymous user cannot see any email addresses", async () => {
    const { data, error } = await anonClient
      .from("public_profiles_view")
      .select("id, email");

    expect(error).toBeNull();

    // All emails should be null for anonymous users
    const allEmailsAreNull = data?.every((r) => r.email === null);
    expect(allEmailsAreNull).toBe(true);
  });

  it("invited_users are only viewable by administrators", async () => {
    // 1. Check as Admin
    const authenticatedAdminClient = createClient(supabaseUrl, supabaseAnonKey);
    await authenticatedAdminClient.auth.signInWithPassword({
      email: adminUser.email,
      password: "TestPassword123",
    });

    const { data: adminView, error: adminError } =
      await authenticatedAdminClient.from("invited_users").select("id");

    expect(adminError).toBeNull();
    expect(adminView).toBeDefined();

    // 2. Check as Member
    const { data: memberView, error: memberError } = await memberClient
      .from("invited_users")
      .select("id");

    // RLS will just return empty results if not permitted
    expect(memberError).toBeNull();
    expect(memberView).toHaveLength(0);

    // 3. Check as Anonymous
    const { data: anonView, error: anonError } = await anonClient
      .from("invited_users")
      .select("id");

    expect(anonError).toBeNull();
    expect(anonView).toHaveLength(0);
  });
});
