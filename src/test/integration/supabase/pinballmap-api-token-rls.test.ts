import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error(
    "Missing Supabase env vars for PinballMap API-token RLS tests."
  );
}

const adminClient = createClient(supabaseUrl, serviceRoleKey);
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

// Guards the SECURITY DEFINER RPC `get_pinballmap_api_token()` (migration 0057 /
// PP-uusr): only service_role may EXECUTE it, since it decrypts the blanket
// PinballMap X-Api-Token out of Supabase Vault. The migration REVOKEs EXECUTE
// from PUBLIC, anon, and authenticated — this test is the negative-grant
// regression that fails loudly if a future migration re-widens the grant.
describe("get_pinballmap_api_token() RLS", () => {
  let memberUser: { id: string; email: string };
  let memberAuthedClient: SupabaseClient;

  beforeAll(async () => {
    const memberEmail = `pbm-token-rls-member-${Date.now()}@test.com`;
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

    memberAuthedClient = createClient(supabaseUrl, supabaseAnonKey);
    await memberAuthedClient.auth.signInWithPassword({
      email: memberEmail,
      password: "TestPassword123",
    });
  });

  afterAll(async () => {
    await adminClient.auth.admin.deleteUser(memberUser.id);
  });

  it("anonymous role cannot EXECUTE get_pinballmap_api_token()", async () => {
    const { error } = await anonClient.rpc("get_pinballmap_api_token");
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/permission|not.*found/i);
  });

  it("authenticated role cannot EXECUTE get_pinballmap_api_token()", async () => {
    const { error } = await memberAuthedClient.rpc("get_pinballmap_api_token");
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/permission|not.*found/i);
  });

  it("service role can EXECUTE get_pinballmap_api_token()", async () => {
    const { error } = await adminClient.rpc("get_pinballmap_api_token");
    // Returns a scalar text token, or NULL when no Vault secret is linked yet —
    // both are success. The point is that service_role is not permission-denied.
    expect(error).toBeNull();
  });
});
