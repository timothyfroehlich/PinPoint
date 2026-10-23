import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * PostgREST access to user_profiles and issues (PP-7ruw).
 *
 * The app reaches both tables through Drizzle and the service-role client,
 * which bypass RLS. A browser holding the publishable key must not be able to
 * promote itself, edit or delete profiles, or read anyone else's email or any
 * issue. A member may read only their own profile row; the admin policies on
 * other tables depend on that lookup.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars for RLS tests: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY."
  );
}

const serviceClient = createClient(supabaseUrl, serviceRoleKey);
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

interface TestUser {
  id: string;
  client: SupabaseClient;
}

async function createSignedInUser(
  label: string,
  role: "admin" | "member"
): Promise<TestUser> {
  const email = `profiles-rls-${label}-${Date.now()}@test.com`;
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password: "TestPassword123",
    email_confirm: true,
    user_metadata: { first_name: "Profiles", last_name: label, role },
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? `${label} user not created`);
  }
  const id = data.user.id;

  // user_profiles.role is the source of truth; set it explicitly.
  const { error: roleError } = await serviceClient
    .from("user_profiles")
    .update({ role })
    .eq("id", id);
  if (roleError) throw new Error(roleError.message);

  const client = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: "TestPassword123",
  });
  if (signInError) throw new Error(signInError.message);

  return { id, client };
}

async function readProfile(
  id: string
): Promise<{ role: string; avatar_url: string | null }> {
  const { data, error } = await serviceClient
    .from("user_profiles")
    .select("role, avatar_url")
    .eq("id", id)
    .single<{ role: string; avatar_url: string | null }>();
  if (error) throw new Error(error.message);
  return data;
}

describe("user_profiles and issues RLS (PP-7ruw)", () => {
  let admin: TestUser;
  let member: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    admin = await createSignedInUser("admin", "admin");
    member = await createSignedInUser("member", "member");
    other = await createSignedInUser("other", "member");
  });

  afterAll(async () => {
    for (const user of [admin, member, other]) {
      await serviceClient.auth.admin.deleteUser(user.id);
    }
  });

  it("a member cannot promote themselves to admin", async () => {
    const { data, error } = await member.client
      .from("user_profiles")
      .update({ role: "admin" })
      .eq("id", member.id)
      .select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect((await readProfile(member.id)).role).toBe("member");
  });

  it("a member cannot change their own avatar_url", async () => {
    const before = await readProfile(member.id);
    const { data, error } = await member.client
      .from("user_profiles")
      .update({ avatar_url: "https://example.com/not-mine.png" })
      .eq("id", member.id)
      .select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect((await readProfile(member.id)).avatar_url).toBe(before.avatar_url);
  });

  it("an admin cannot change another profile through the REST API", async () => {
    const { data, error } = await admin.client
      .from("user_profiles")
      .update({ role: "admin" })
      .eq("id", other.id)
      .select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect((await readProfile(other.id)).role).toBe("member");
  });

  it("neither a member nor an admin can delete a profile", async () => {
    for (const actor of [member, admin]) {
      const { error } = await actor.client
        .from("user_profiles")
        .delete()
        .eq("id", other.id);
      expect(error).toBeNull();
    }
    expect((await readProfile(other.id)).role).toBe("member");
  });

  it("a member reads only their own profile row", async () => {
    const { data, error } = await member.client
      .from("user_profiles")
      .select("id, email");

    expect(error).toBeNull();
    expect(data?.map((row) => row.id)).toEqual([member.id]);
  });

  it("a member reads no issues", async () => {
    const { data: seeded, error: seededError } = await serviceClient
      .from("issues")
      .select("id")
      .limit(1);
    expect(seededError).toBeNull();
    // Without a seeded issue the empty result below would prove nothing.
    expect(seeded).toHaveLength(1);

    const { data, error } = await member.client
      .from("issues")
      .select("id, reporter_email");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("an anonymous client reads no profiles and no issues", async () => {
    for (const table of ["user_profiles", "issues"]) {
      const { data, error } = await anonClient.from(table).select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });
});
