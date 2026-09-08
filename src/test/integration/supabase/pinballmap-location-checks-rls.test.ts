import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars for PinballMap check RLS tests.");
}

const serviceClient = createClient(supabaseUrl, serviceRoleKey);

describe("PinballMap location-check candidates RLS", () => {
  const checkId = randomUUID();
  let memberId: string | undefined;
  let memberClient: SupabaseClient;

  beforeAll(async () => {
    const email = `pbm-check-rls-member-${Date.now()}@test.com`;
    const { data: userData, error: userError } =
      await serviceClient.auth.admin.createUser({
        email,
        password: "TestPassword123",
        email_confirm: true,
        user_metadata: {
          first_name: "Candidate",
          last_name: "Reader",
          role: "member",
        },
      });
    if (userError || !userData.user) {
      throw new Error(userError?.message ?? "member user not created");
    }
    memberId = userData.user.id;

    const { error: insertError } = await serviceClient
      .from("pinballmap_location_checks")
      .insert({
        id: checkId,
        location_id: 26454,
        expected_location_id: 26454,
        expected_configuration_generation: 0,
        snapshot_json: { locationId: 26454, name: "Server-only fixture" },
        checked_by: memberId,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
    if (insertError) throw new Error(insertError.message);

    memberClient = createClient(supabaseUrl, supabaseAnonKey);
    const { error: signInError } = await memberClient.auth.signInWithPassword({
      email,
      password: "TestPassword123",
    });
    if (signInError) throw new Error(signInError.message);
  });

  afterAll(async () => {
    await serviceClient
      .from("pinballmap_location_checks")
      .delete()
      .eq("id", checkId);
    if (memberId) await serviceClient.auth.admin.deleteUser(memberId);
  });

  it("allows the service role to read a retained candidate", async () => {
    const { data, error } = await serviceClient
      .from("pinballmap_location_checks")
      .select("id")
      .eq("id", checkId);

    expect(error).toBeNull();
    expect(data).toEqual([{ id: checkId }]);
  });

  it("exposes no candidate rows to an authenticated browser client", async () => {
    const { data, error } = await memberClient
      .from("pinballmap_location_checks")
      .select("*");

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("allows no candidate writes from an authenticated browser client", async () => {
    const { error } = await memberClient
      .from("pinballmap_location_checks")
      .insert({
        location_id: 99999,
        expected_configuration_generation: 0,
        snapshot_json: { locationId: 99999, name: "Forged candidate" },
        checked_by: memberId,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    expect(error).not.toBeNull();
  });
});
