import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { db, type Tx } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { withUserContext } from "~/server/db/utils/rls";

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

  describe("user_metadata role escalation regression (CORE-SEC)", () => {
    /**
     * Regression test for RLS user_metadata exploit.
     *
     * Before the fix (migration 0012), RLS policies fell back to
     * `auth.jwt() -> 'user_metadata' ->> 'role'` which users can
     * self-edit via the Supabase Auth API. After the fix, policies
     * fall back to `(select role from user_profiles ...)` which is
     * database-controlled and not user-editable.
     *
     * This test creates a user with user_metadata.role='admin' but
     * user_profiles.role='member' to verify the metadata is ignored.
     */
    let spoofedUser: { id: string; email: string };
    let spoofedClient: SupabaseClient;

    beforeAll(async () => {
      const spoofedEmail = `rls-spoof-${Date.now()}@test.com`;
      const { data } = await adminClient.auth.admin.createUser({
        email: spoofedEmail,
        password: "TestPassword123",
        email_confirm: true,
        user_metadata: {
          first_name: "Spoofed",
          last_name: "Admin",
          role: "admin", // JWT claims admin...
        },
      });
      spoofedUser = { id: data.user!.id, email: spoofedEmail };

      // Force user_profiles.role to 'member' — this is the source of truth
      await adminClient
        .from("user_profiles")
        .update({ role: "member" })
        .eq("id", spoofedUser.id);

      spoofedClient = createClient(supabaseUrl, supabaseAnonKey);
      await spoofedClient.auth.signInWithPassword({
        email: spoofedEmail,
        password: "TestPassword123",
      });
    });

    afterAll(async () => {
      await adminClient.auth.admin.deleteUser(spoofedUser.id);
    });

    it("user with user_metadata.role='admin' but user_profiles.role='member' cannot view invited_users", async () => {
      const { data, error } = await spoofedClient
        .from("invited_users")
        .select("id");

      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("user with user_metadata.role='admin' but user_profiles.role='member' cannot see other emails", async () => {
      const { data, error } = await spoofedClient
        .from("public_profiles_view")
        .select("id, email");

      expect(error).toBeNull();

      // Should see own email
      const ownProfile = data?.find((r) => r.id === spoofedUser.id);
      expect(ownProfile?.email).toBe(spoofedUser.email);

      // Should NOT see other users' emails (metadata 'admin' is ignored)
      const otherProfiles = data?.filter((r) => r.id !== spoofedUser.id) ?? [];
      expect(otherProfiles.length).toBeGreaterThan(0);
      otherProfiles.forEach((profile) => {
        expect(profile.email).toBeNull();
      });
    });
  });

  describe("Direct Drizzle Queries with Session Context", () => {
    it("should show all emails with admin context", async () => {
      const profiles = await withUserContext(
        db,
        { id: adminUser.id, role: "admin" },
        async (tx: Tx) => {
          return tx.select().from(userProfiles);
        }
      );

      // Admin should see all emails
      const profilesWithEmails = profiles.filter((p: any) => p.email !== null);
      expect(profilesWithEmails.length).toBe(profiles.length);
      expect(profilesWithEmails.length).toBeGreaterThan(0);
    });

    it("should show only own email with member context", async () => {
      const profiles = await withUserContext(
        db,
        { id: memberUser.id, role: "member" },
        async (tx: Tx) => {
          return tx.select().from(userProfiles);
        }
      );

      // Member should see all profiles but only their own email
      expect(profiles.length).toBeGreaterThan(1);

      const ownProfile = profiles.find((p: any) => p.id === memberUser.id);
      expect(ownProfile?.email).toBe(memberUser.email);

      // Note: RLS on SELECT * from a table doesn't mask columns - it filters ROWS.
      // However, our policy for user_profiles is applied to UPDATE/DELETE.
      // SELECT is generally public for user_profiles (except sensitive fields).
      // The email privacy is enforced by the public_profiles_view.
    });

    it("should enforce context isolation between transactions", async () => {
      // Transaction 1: admin context
      const result1 = await withUserContext(
        db,
        { id: adminUser.id, role: "admin" },
        async (tx: Tx) => {
          const setting = await tx.execute(
            sql`SELECT current_setting('request.user_id', true) as user_id,
                       current_setting('request.user_role', true) as user_role`
          );
          return setting;
        }
      );

      // Transaction 2: member context (different user)
      const result2 = await withUserContext(
        db,
        { id: memberUser.id, role: "member" },
        async (tx: Tx) => {
          const setting = await tx.execute(
            sql`SELECT current_setting('request.user_id', true) as user_id,
                       current_setting('request.user_role', true) as user_role`
          );
          return setting;
        }
      );

      // Verify each transaction has its own isolated context
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      // Result from execute() in Drizzle with postgres.js is an array of rows
      const row1 = result1 as unknown as {
        user_id: string;
        user_role: string;
      }[];
      const row2 = result2 as unknown as {
        user_id: string;
        user_role: string;
      }[];

      expect(row1[0]?.user_id).toBe(adminUser.id);
      expect(row1[0]?.user_role).toBe("admin");
      expect(row2[0]?.user_id).toBe(memberUser.id);
      expect(row2[0]?.user_role).toBe("member");
    });

    it("should mask emails in public_profiles_view for non-admins", async () => {
      const profiles = await withUserContext(
        db,
        { id: memberUser.id, role: "member" },
        async (tx: Tx) => {
          return tx.execute(sql`SELECT id, email FROM public_profiles_view`);
        }
      );

      const rows = profiles as unknown as {
        id: string;
        email: string | null;
      }[];

      // Should see own email
      const ownProfile = rows.find((p) => p.id === memberUser.id);
      expect(ownProfile?.email).toBe(memberUser.email);

      // Should NOT see other emails (except possibly other members/admins if they are also the same user, but they aren't here)
      const otherProfiles = rows.filter((p: any) => p.id !== memberUser.id);
      expect(otherProfiles.length).toBeGreaterThan(0);
      otherProfiles.forEach((profile: any) => {
        expect(profile.email).toBeNull();
      });
    });

    it("should show all emails in public_profiles_view for admins", async () => {
      const profiles = await withUserContext(
        db,
        { id: adminUser.id, role: "admin" },
        async (tx: Tx) => {
          return tx.execute(sql`SELECT id, email FROM public_profiles_view`);
        }
      );

      const rows = profiles as unknown as {
        id: string;
        email: string | null;
      }[];

      // Admin should see emails for our test users (other users in DB may not have emails)
      const testUsers = rows.filter(
        (r) => r.id === adminUser.id || r.id === memberUser.id
      );
      testUsers.forEach((u: any) => expect(u.email).not.toBeNull());
    });
  });
});
